import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import Mock, patch

import httpx

from app.services import plane_service

# These regression tests exercise the service's filter-matching internals directly.
# ruff: noqa: SLF001


class WatchlistFilterTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = plane_service.DB_PATH
        plane_service.DB_PATH = Path(self.temp_dir.name) / "planes.db"
        plane_service._init_db()

    def tearDown(self):
        plane_service.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_only_watchlist_has_altitude_ceiling(self):
        with closing(plane_service._get_db()) as conn:
            settings_columns = {row["name"] for row in conn.execute("PRAGMA table_info(settings)")}
            watchlist_columns = {
                row["name"] for row in conn.execute("PRAGMA table_info(watchlist)")
            }

        assert "max_altitude_ft" not in settings_columns
        assert "home_lat" not in settings_columns
        assert "home_lon" not in settings_columns
        assert "active_location_profile_id" in settings_columns
        assert "max_altitude_ft" in watchlist_columns

    def test_location_profiles_have_one_active_location(self):
        home = plane_service.add_location_profile("Home")
        assert home["is_active"] is True
        assert home["lat"] is None

        home = plane_service.update_location_profile(home["id"], {"lat": 40.5847, "lon": -111.8271})
        assert home is not None
        assert home["lat"] == 40.5847

        cabin = plane_service.add_location_profile("Cabin")
        profiles = plane_service.list_location_profiles()
        assert [profile["name"] for profile in profiles if profile["is_active"]] == ["Cabin"]

        plane_service.activate_location_profile(home["id"])
        settings = plane_service.get_settings()
        assert settings["active_location_profile_id"] == home["id"]
        assert plane_service._get_location_profile(cabin["id"])["is_active"] is False

    def test_aircraft_provider_falls_back_to_adsb_fi(self):
        fallback_response = Mock()
        fallback_response.json.return_value = {"aircraft": [{"hex": "abc123"}]}

        with patch.object(
            plane_service.httpx,
            "get",
            side_effect=[httpx.ConnectError("ADSB.lol unavailable"), fallback_response],
        ) as get:
            aircraft, provider = plane_service._fetch_aircraft(40.5, -111.8, 40)

        assert aircraft == [{"hex": "abc123"}]
        assert provider == "ADSB.fi"
        assert get.call_count == 2

    def test_adsb_lol_response_shape_is_supported(self):
        primary_response = Mock()
        primary_response.json.return_value = {"ac": [{"hex": "def456"}]}

        with patch.object(plane_service.httpx, "get", return_value=primary_response) as get:
            aircraft, provider = plane_service._fetch_aircraft(40.5, -111.8, 40)

        assert aircraft == [{"hex": "def456"}]
        assert provider == "ADSB.lol"
        assert get.call_count == 1

    def test_filter_altitude_ceiling_and_edit(self):
        entry = plane_service.add_watchlist_entry("Military", "callsign_prefix", "RCH", 10_000)

        assert (
            plane_service._match_watchlist(
                {"hex": "abc", "flight": "RCH123", "alt_baro": 9_000}, [entry]
            )
            == entry
        )
        assert (
            plane_service._match_watchlist(
                {"hex": "abc", "flight": "RCH123", "alt_baro": 20_000}, [entry]
            )
            is None
        )

        updated = plane_service.update_watchlist_entry(
            entry["id"], "Low military", "callsign_prefix", "RCH", 5_000
        )

        assert updated is not None
        assert updated["label"] == "Low military"
        assert updated["max_altitude_ft"] == 5_000


if __name__ == "__main__":
    unittest.main()
