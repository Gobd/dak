"""Pydantic models for the money/spend-tracking endpoints."""

from typing import Any

from pydantic import BaseModel


class LinkAccountRequest(BaseModel):
    """Request to link SimpleFIN accounts via a one-time setup token."""

    setup_token: str


class LinkedAccountInfo(BaseModel):
    """A linked SimpleFIN account."""

    id: str
    name: str
    org_name: str
    currency: str
    last_transaction_posted: str | None = None


class BudgetRequest(BaseModel):
    """Request to set the default monthly budget."""

    monthly_budget: float


class MonthlyOverrideRequest(BaseModel):
    """Request to set a one-off budget override for a given month."""

    month: str  # "YYYY-MM"
    budget: float


class DepositSettingsRequest(BaseModel):
    """Request to configure paycheck matching and the large-deposit threshold.

    large_deposit_threshold=None disables large-deposit notifications entirely.
    A threshold of 0 is a valid, distinct value ("notify on any deposit").
    """

    paycheck_strings: list[str]
    large_deposit_threshold: float | None = None


class TransferSettingsRequest(BaseModel):
    """Request to configure transfer/payment keyword matching."""

    transfer_keywords: list[str]


class ExcludeTransactionRequest(BaseModel):
    """Request to manually mark a transaction as excluded (or included)."""

    excluded: bool
    reason: str | None = None


class SpendSummary(BaseModel):
    """Current month spend vs. ghost pace vs. budget."""

    monthly_budget: float
    is_override: bool
    month_start: str
    days_in_month: int
    day_of_month: int
    spent_to_date: float
    ghost_to_date: float
    projected_month_total: float
    linked_accounts: list[LinkedAccountInfo]
    last_synced_at: str | None
    last_sync_error: str | None = None


class TransactionOut(BaseModel):
    """A cached transaction, for the widget's recent-transactions list."""

    id: str
    account_name: str
    posted: str
    amount: float
    description: str
    payee: str
    excluded: bool
    exclude_reason: str | None
    is_paycheck: bool


class MoneySettings(BaseModel):
    """Current money-tracker settings (for populating the settings modal)."""

    default_monthly_budget: float
    current_month_override: float | None
    paycheck_strings: list[str]
    large_deposit_threshold: float | None
    transfer_keywords: list[str]
    linked_accounts: list[LinkedAccountInfo]


class GenericSuccess(BaseModel):
    """Generic success response."""

    success: bool
    data: dict[str, Any] | None = None
