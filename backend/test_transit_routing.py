import unittest
from unittest.mock import patch
from datetime import datetime
import combined_router as router


class TransitRoutingEngineTests(unittest.TestCase):
    def setUp(self):
        self.depart_dt = datetime(2026, 9, 12, 9, 0, 0)
        # Mock external network Valhalla / weather calls for deterministic fast execution
        self.patcher_geo = patch("combined_router.fetch_valhalla_geometry", side_effect=lambda pts: [{"lat": p[0], "lon": p[1]} for p in pts])
        self.mock_geo = self.patcher_geo.start()

    def tearDown(self):
        self.patcher_geo.stop()

    def test_glenwood_court_to_king_soopers_prefers_direct_route(self):
        """
        Critical Requirement Test:
        2777 Glenwood Court (~40.0340, -105.2590) to King Soopers on 30th & Arapahoe (~40.0145, -105.2530)
        or 28th St & Canyon/Mall must NOT generate an incorrect multi-bus loop transfer when direct
        RTD 205 (or BOUND) serves the corridor.
        """
        orig_lat, orig_lon = 40.0340, -105.2590
        dest_lat, dest_lon = 40.0145, -105.2530

        journey = router.plan_boulder_multimodal_journey(
            orig_lat, orig_lon, dest_lat, dest_lon, self.depart_dt
        )

        # Must have 0 transfers for a direct corridor
        self.assertEqual(journey["num_transfers"], 0, "Glenwood Court to King Soopers should choose a direct single-seat bus route!")
        self.assertTrue(len(journey["legs"]) >= 1)
        self.assertIn("RTD", journey["legs"][0]["route_id"])
        self.assertIn("Southbound", journey["legs"][0]["direction"])

    def test_short_distance_walk_only_journey(self):
        """When origin and destination are < 450m apart, return a direct walk with 0 transfers."""
        orig_lat, orig_lon = 40.0176, -105.2797  # Pearl St
        dest_lat, dest_lon = 40.0180, -105.2790  # 1 block away

        journey = router.plan_boulder_multimodal_journey(
            orig_lat, orig_lon, dest_lat, dest_lon, self.depart_dt
        )

        self.assertEqual(journey["num_transfers"], 0)
        self.assertEqual(len(journey["legs"]), 1)
        self.assertEqual(journey["legs"][0]["mode"], "WALK")
        self.assertIn("Walking", journey["legs"][0]["route_id"])

    def test_williams_village_to_umc_direct_buff_bus(self):
        """Williams Village to CU UMC should use direct Buff Bus or SKIP."""
        orig_lat, orig_lon = 40.0000, -105.2520  # Williams Village
        dest_lat, dest_lon = 40.0070, -105.2725  # CU UMC

        journey = router.plan_boulder_multimodal_journey(
            orig_lat, orig_lon, dest_lat, dest_lon, self.depart_dt
        )

        self.assertEqual(journey["num_transfers"], 0)
        self.assertTrue(any("Buff Bus" in leg["route_id"] or "SKIP" in leg["route_id"] for leg in journey["legs"]))

    def test_cross_town_transfer_generates_valid_connection(self):
        """
        Cross-town route where origin is far North-West (Sanitas area) and dest is far East (Arapahoe & 55th):
        Requires valid transfer hub connection with realistic transfer buffer.
        """
        orig_lat, orig_lon = 40.0380, -105.2810  # North Broadway (SKIP)
        dest_lat, dest_lon = 40.0140, -105.2280  # East Arapahoe 55th (JUMP)

        journey = router.plan_boulder_multimodal_journey(
            orig_lat, orig_lon, dest_lat, dest_lon, self.depart_dt
        )

        self.assertTrue(len(journey["legs"]) >= 1)
        if journey["num_transfers"] == 1:
            self.assertEqual(len(journey["legs"]), 2)
            t_arr_1 = datetime.strptime(journey["legs"][0]["arrival"], "%I:%M %p")
            t_dep_2 = datetime.strptime(journey["legs"][1]["departure"], "%I:%M %p")
            self.assertGreaterEqual(t_dep_2, t_arr_1, "Transfer departure must be after arrival of leg 1")

    def test_biking_alternative_generated(self):
        """Every multimodal query should include ranked alternatives including biking."""
        orig_lat, orig_lon = 40.0100, -105.2600
        dest_lat, dest_lon = 40.0250, -105.2500

        journey = router.plan_boulder_multimodal_journey(
            orig_lat, orig_lon, dest_lat, dest_lon, self.depart_dt
        )

        self.assertTrue(len(journey["alternatives"]) >= 1)
        bike_alt = next((a for a in journey["alternatives"] if a["mode"] == "bicycling"), None)
        self.assertIsNotNone(bike_alt, "Should include a bike alternative")
        self.assertEqual(bike_alt["badge"], "Best for Biking")

    def test_plan_transit_full_api_contract(self):
        """Validates API payload structure of /plan_transit_full."""
        req = router.PlanTransitRequest(
            origin=router.Location(lat=40.0340, lon=-105.2590),
            destination=router.Location(lat=40.0145, lon=-105.2530),
            depart_at=self.depart_dt.isoformat(),
        )
        res = router.plan_transit_full(req)

        self.assertIn("mode", res)
        self.assertIn("transit", res)
        self.assertIn("weather", res)
        self.assertIn("prediction", res)
        self.assertIn("on_time_probability", res)
        self.assertIn("alternatives", res)
        self.assertIn("summary", res)
        self.assertIn("departure", res["weather"])
        self.assertIn("arrival", res["weather"])


if __name__ == "__main__":
    unittest.main()
