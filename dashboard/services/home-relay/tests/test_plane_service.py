import tempfile
import unittest
from pathlib import Path

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
