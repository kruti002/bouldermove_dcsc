import json
import unittest
from unittest.mock import Mock, patch
from datetime import datetime

import polyline
import combined_router as router


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.ok = status_code == 200

    def raise_for_status(self):
        if self.status_code >= 400:
            raise router.requests.RequestException(f"HTTP {self.status_code}")
        return None

    def json(self):
        return self.payload


class CombinedRouterContractTests(unittest.TestCase):
    def test_health_check_contract(self):
        res = router.health_check()
        self.assertEqual(res["status"], "ok")
        self.assertIn("model_loaded", res)
        self.assertEqual(res["service"], "BoulderMove Prediction & Routing API")

    def test_predict_route_time(self):
        features = {
            "duration_min": 25.0,
            "buffer_min": 5.0,
            "num_transfers": 0,
            "rain_1h": 0.0,
            "snow_1h": 0.0,
            "wind_speed": 3.0,
            "temp": 22.0,
            "event_risk": 0.0,
            "hour": 14,
            "is_weekend": False,
        }
        pred = router.predict_route_time(features, datetime(2026, 9, 10, 14, 0, 0))
        self.assertIn("base_duration_minutes", pred)
        self.assertIn("predicted_duration_minutes", pred)
        self.assertIn("predicted_arrival", pred)
        self.assertIn("prob_on_time", pred)
        self.assertIn("traffic_condition", pred)
        self.assertGreater(pred["predicted_duration_minutes"], 0)

    def test_osm_no_route_response_contract(self):
        with patch.object(
            router.requests,
            "post",
            return_value=FakeResponse({}, status_code=404),
        ):
            response = router.osm_directions(
                origin="40,-105",
                destination="40.2,-105.2",
            )

        self.assertEqual(response["routes"], [])
        self.assertEqual(
            response["error"],
            {
                "code": "no_route",
                "message": "No route connects those locations for the selected travel mode.",
            },
        )

    def test_osm_provider_failure_response_contract(self):
        with patch.object(
            router.requests,
            "post",
            side_effect=router.requests.RequestException("provider down"),
        ):
            response = router.osm_directions(
                origin="40,-105",
                destination="40.2,-105.2",
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            json.loads(response.body),
            {
                "error": {
                    "code": "provider_failure",
                    "message": "The road routing service is temporarily unavailable.",
                }
            },
        )

    def test_osm_directions_maps_geometry_and_alternatives(self):
        primary_shape = polyline.encode(
            [(40.0, -105.0), (40.1, -105.1), (40.2, -105.2)],
            precision=6,
        )
        alternate_shape = polyline.encode(
            [(40.0, -105.0), (40.08, -105.05), (40.2, -105.2)],
            precision=6,
        )
        valhalla_response = FakeResponse(
            {
                "trip": {
                    "summary": {"time": 600, "length": 5},
                    "legs": [{"shape": primary_shape}],
                },
                "alternates": [
                    {
                        "trip": {
                            "summary": {"time": 720, "length": 6.5},
                            "legs": [{"shape": alternate_shape}],
                        }
                    }
                ],
            }
        )

        with patch.object(
            router.requests,
            "post",
            side_effect=[valhalla_response, FakeResponse({})],
        ) as post:
            with patch.object(
                router,
                "get_optional_weather",
                return_value=None,
            ), patch.object(
                router,
                "get_optional_events",
                return_value={"count": 0, "events": []},
            ):
                response = router.osm_directions(
                    origin="40,-105",
                    destination="40.2,-105.2",
                    mode="driving",
                    alternatives=True,
                )

        self.assertEqual(len(response["routes"]), 2)
        self.assertEqual(
            response["routes"][0]["geometry"]["coordinates"],
            [[-105.0, 40.0], [-105.1, 40.1], [-105.2, 40.2]],
        )
        self.assertEqual(response["routes"][1]["distance"], 6500)
        post.assert_called_once()
        valhalla_call = post.call_args
        self.assertEqual(valhalla_call.args[0], "https://valhalla1.openstreetmap.de/route")
        self.assertEqual(valhalla_call.kwargs["json"]["alternates"], 2)

    def test_transit_response_contains_full_geometry_and_stops(self):
        with patch.object(
            router,
            "get_optional_weather",
            return_value={"temp": 20, "rain_1h": 0, "snow_1h": 0, "wind_speed": 2},
        ), patch.object(
            router,
            "get_optional_events",
            return_value={"count": 0, "events": []},
        ):
            response = router.plan_transit_full(
                router.PlanTransitRequest(
                    origin={"lat": 40.0162, "lon": -105.2770},
                    destination={"lat": 40.0070, "lon": -105.2725},
                    depart_at="2026-09-10T08:00:00",
                )
            )

        self.assertEqual(response["mode"], "walk_transit_walk")
        self.assertIn("transit", response)
        self.assertGreater(len(response["transit"]), 0)
        self.assertIn("geometry", response)
        self.assertIn("prediction", response)
        self.assertEqual(response["ml_features_used"]["event_risk"], 0.0)

    def test_optional_provider_failures_return_empty_context(self):
        with patch.object(
            router,
            "get_weather_and_alerts",
            side_effect=router.WeatherError("weather provider unavailable"),
        ):
            self.assertIsNone(router.get_optional_weather(40.0, -105.0))

        with patch.object(
            router,
            "events_near_route",
            side_effect=RuntimeError("events provider unavailable"),
        ):
            self.assertEqual(
                router.get_optional_events([(40.0, -105.0)]),
                {"count": 0, "events": []},
            )

    def test_geocode_address(self):
        # Direct coords
        res = router.geocode_address("40.0150, -105.2705")
        self.assertEqual(len(res["results"]), 1)
        self.assertAlmostEqual(res["results"][0]["lat"], 40.0150)
        self.assertAlmostEqual(res["results"][0]["lon"], -105.2705)

    def test_will_vill_buff_bus_corridor_present(self):
        self.assertIn("WILL_VILL", router.RTD_CORRIDORS)
        corr = router.RTD_CORRIDORS["WILL_VILL"]
        self.assertIn("Buff Bus", corr["name"])
        stop_names = [s["name"] for s in corr["stops"]]
        self.assertTrue(any("Williams Village" in s for s in stop_names))
        self.assertTrue(any("Bear Creek" in s for s in stop_names))

    def test_parse_trip_phrase_nlp(self):
        parsed = router.parse_trip_phrase("I am at Williams Village and want to go to Norlin Library by 9:00 AM")
        self.assertIn("Williams Village", parsed["origin"])
        self.assertIn("Norlin Library", parsed["destination"])
        self.assertEqual(parsed["time_type"], "arrive_by")
        self.assertIn("9:00", parsed["target_time"])

    def test_parse_natural_query_endpoint(self):
        with patch.object(router, "get_optional_weather", return_value={"temp": 22, "rain_1h": 0, "snow_1h": 0, "wind_speed": 2}), \
             patch.object(router, "get_optional_events", return_value={"count": 0, "events": []}):
            res = router.parse_natural_query_endpoint(
                router.QueryParseRequest(query="From Williams Village to CU UMC by bus")
            )
            self.assertIn("smart_leave_time", res)
            self.assertIn("speech_response", res)
            self.assertIn("duration_minutes", res)


if __name__ == "__main__":
    unittest.main()
