import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from app.services import money_service

# The regression exercises the service's transaction-detection pipeline directly.
# ruff: noqa: SLF001


class TransferDetectionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = money_service.DB_PATH
        money_service.DB_PATH = Path(self.temp_dir.name) / "money.db"
        money_service._init_db()

    def tearDown(self):
        money_service.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_card_payment_is_not_reported_as_large_deposit(self):
        money_service.set_deposit_settings([], 500)
        money_service.set_transfer_keywords(["payment"])
        posted = datetime.now() - timedelta(days=1)
        bank_rows = money_service._upsert_transactions(
            [
                {
                    "id": "bank",
                    "name": "Checking",
                    "transactions": [
                        {
                            "id": "bank-payment",
                            "posted": posted.timestamp(),
                            "amount": "-1000.00",
                            "description": "Online payment",
                        }
                    ],
                }
            ]
        )
        money_service._detect_transfers(bank_rows)

        card_rows = money_service._upsert_transactions(
            [
                {
                    "id": "card",
                    "name": "Credit Card",
                    "transactions": [
                        {
                            "id": "card-credit",
                            "posted": (posted + timedelta(days=1)).timestamp(),
                            "amount": "1000.00",
                            "description": "Thank you",
                        }
                    ],
                },
            ]
        )

        with patch.object(money_service.notification_service, "add_event") as add_event:
            money_service._detect_transfers(card_rows)
            money_service._detect_deposits(card_rows)

        add_event.assert_not_called()
        with money_service._get_db() as conn:
            transactions = conn.execute(
                "SELECT id, excluded, exclude_reason FROM transactions_cache ORDER BY id"
            ).fetchall()
        assert [(row["id"], row["excluded"], row["exclude_reason"]) for row in transactions] == [
            ("bank-payment", 1, "transfer_pair"),
            ("card-credit", 1, "transfer_pair"),
        ]


if __name__ == "__main__":
    unittest.main()
