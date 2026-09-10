import unittest
from unittest.mock import Mock, patch

import pandas as pd
import polyline

import combined_router as router


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class CombinedRouterContractTests(unittest.TestCase):
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
        router.stops_gdf = pd.DataFrame(
            [
                {
                    "stop_id": "origin-stop",
                    "nearest_node": 10,
                    "stop_lat": 40.01,
                    "stop_lon": -105.01,
                },
                {
                    "stop_id": "dest-stop",
                    "nearest_node": 20,
                    "stop_lat": 40.19,
                    "stop_lon": -105.19,
                },
                {
                    "stop_id": "stop-1",
                    "nearest_node": 11,
                    "stop_lat": 40.1,
                    "stop_lon": -105.1,
                },
                {
                    "stop_id": "stop-2",
                    "nearest_node": 12,
                    "stop_lat": 40.15,
                    "stop_lon": -105.15,
                },
            ]
        )
        router.raptor = Mock()
        router.raptor.plan.return_value = [
            {
                "route_id": "BOLT",
                "intermediate_stops": ["stop-1", "stop-2"],
                "duration_min": 25,
            }
        ]

        with patch.object(
            router,
            "nearest_gtfs_stop",
            side_effect=["origin-stop", "dest-stop"],
        ), patch.object(
            router,
            "nearest_graph_node",
            side_effect=[1, 4],
        ), patch.object(
            router.nx,
            "shortest_path",
            side_effect=[[1, 2], [3, 4]],
        ), patch.object(
            router,
            "path_to_latlon",
            side_effect=[
                [{"lat": 40.0, "lon": -105.0}],
                [{"lat": 40.2, "lon": -105.2}],
            ],
        ), patch.object(
            router,
            "get_optional_weather",
            return_value=None,
        ), patch.object(
            router,
            "get_optional_events",
            return_value={"count": 0, "events": []},
        ), patch.object(
            router,
            "score_route",
            return_value={"prob_on_time": None, "expected_delay_min": None},
        ):
            response = router.plan_transit_full(
                router.PlanTransitRequest(
                    origin={"lat": 40.0, "lon": -105.0},
                    destination={"lat": 40.2, "lon": -105.2},
                    depart_at="2026-09-10T08:00:00",
                )
            )

        self.assertEqual(
            response["geometry"],
            [
                {"lat": 40.0, "lon": -105.0},
                {"lat": 40.1, "lon": -105.1},
                {"lat": 40.15, "lon": -105.15},
                {"lat": 40.2, "lon": -105.2},
            ],
        )
        self.assertEqual(response["transit"][0]["intermediate_stops"], ["stop-1", "stop-2"])
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


if __name__ == "__main__":
    unittest.main()