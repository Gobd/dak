"""Money/spend-tracking endpoints: SimpleFIN link, budget, sync, transactions."""

from fastapi import APIRouter, HTTPException

from app.models.money import (
    BudgetRequest,
    DepositSettingsRequest,
    ExcludeTransactionRequest,
    GenericSuccess,
    LinkAccountRequest,
    LinkedAccountInfo,
    MoneySettings,
    MonthlyOverrideRequest,
    SpendSummary,
    TransactionOut,
    TransferSettingsRequest,
)
from app.services import money_service

router = APIRouter(prefix="/money", tags=["money"])


@router.post("/link", response_model=list[LinkedAccountInfo])
async def link_accounts(request: LinkAccountRequest):
    """Claim a SimpleFIN access URL from a setup token and link accounts."""
    try:
        return money_service.link_accounts(request.setup_token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/link", response_model=GenericSuccess)
async def unlink():
    """Remove the SimpleFIN link and all cached transactions."""
    return money_service.unlink()


@router.get("/summary", response_model=SpendSummary)
async def get_summary():
    """Get current month spend vs. ghost pace vs. effective budget."""
    return money_service.get_spend_summary()


@router.get("/settings", response_model=MoneySettings)
async def get_settings():
    """Get current money-tracker settings."""
    return money_service.get_settings()


@router.get("/transactions", response_model=list[TransactionOut])
async def get_transactions():
    """Get recent cached transactions."""
    return money_service.get_recent_transactions()


@router.post("/transactions/{transaction_id}/exclude", response_model=GenericSuccess)
async def set_transaction_excluded(transaction_id: str, request: ExcludeTransactionRequest):
    """Manually mark a transaction as excluded (or included) from spend totals."""
    return money_service.set_transaction_excluded(transaction_id, request.excluded, request.reason)


@router.post("/budget", response_model=GenericSuccess)
async def set_default_budget(request: BudgetRequest):
    """Set the default monthly budget."""
    return money_service.set_default_budget(request.monthly_budget)


@router.post("/budget/override", response_model=GenericSuccess)
async def set_monthly_override(request: MonthlyOverrideRequest):
    """Set a one-off budget override for a specific month."""
    return money_service.set_monthly_override(request.month, request.budget)


@router.delete("/budget/override/{month}", response_model=GenericSuccess)
async def clear_monthly_override(month: str):
    """Clear a budget override, reverting that month to the default."""
    return money_service.clear_monthly_override(month)


@router.post("/settings/deposits", response_model=GenericSuccess)
async def set_deposit_settings(request: DepositSettingsRequest):
    """Configure paycheck-matching strings and the large-deposit alert threshold."""
    return money_service.set_deposit_settings(
        request.paycheck_strings, request.large_deposit_threshold
    )


@router.post("/settings/transfers", response_model=GenericSuccess)
async def set_transfer_keywords(request: TransferSettingsRequest):
    """Configure transfer/payment keyword matching."""
    return money_service.set_transfer_keywords(request.transfer_keywords)


@router.post("/sync", response_model=GenericSuccess)
async def sync_now():
    """Manually trigger a SimpleFIN transaction sync."""
    result = money_service.sync_transactions()
    return {"success": result["success"], "data": result}
