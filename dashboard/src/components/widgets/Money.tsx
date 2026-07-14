import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Modal, ConfirmModal, Button, Input, Spinner, Badge, Toggle, EmptyState, Alert } from '@dak/ui';
import {
  getSummaryMoneySummaryGet,
  getSettingsMoneySettingsGet,
  getTransactionsMoneyTransactionsGet,
  linkAccountsMoneyLinkPost,
  unlinkMoneyLinkDelete,
  syncNowMoneySyncPost,
  setDefaultBudgetMoneyBudgetPost,
  setMonthlyOverrideMoneyBudgetOverridePost,
  clearMonthlyOverrideMoneyBudgetOverrideMonthDelete,
  setDepositSettingsMoneySettingsDepositsPost,
  setTransferKeywordsMoneySettingsTransfersPost,
  setTransactionExcludedMoneyTransactionsTransactionIdExcludePost,
  type SpendSummary,
  type MoneySettings,
  type TransactionOut,
} from '@dak/api-client';
import { useWidgetQuery } from '../../hooks/useWidgetQuery';
import { getRelayUrl } from '../../stores/config-store';
import type { WidgetComponentProps } from './index';

const RADIUS = 60;
const STROKE_WIDTH = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysAgo <= 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return `${daysAgo}d ago`;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== new Date().getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', options);
}

interface DonutProps {
  spent: number;
  ghost: number;
  budget: number;
}

function SpendDonut({ spent, ghost, budget }: DonutProps) {
  const spentFraction = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const ghostFraction = budget > 0 ? Math.min(ghost / budget, 1) : 0;
  const isAhead = spent > ghost;

  const spentOffset = CIRCUMFERENCE * (1 - spentFraction);
  const ghostAngle = ghostFraction * 360 - 90;
  const ghostX = 90 + RADIUS * Math.cos((ghostAngle * Math.PI) / 180);
  const ghostY = 90 + RADIUS * Math.sin((ghostAngle * Math.PI) / 180);

  const spentColor = isAhead ? 'var(--color-danger)' : 'var(--color-success)';

  return (
    <svg viewBox="0 0 180 180" className="w-full h-full max-w-[160px] max-h-[160px]">
      <circle
        cx="90"
        cy="90"
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        className="stroke-surface-sunken"
      />
      <circle
        cx="90"
        cy="90"
        r={RADIUS}
        fill="none"
        stroke={spentColor}
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={spentOffset}
        strokeLinecap="round"
        transform="rotate(-90 90 90)"
      />
      {/* Ghost pace marker */}
      <circle cx={ghostX} cy={ghostY} r={STROKE_WIDTH / 2 + 2} className="fill-text" />
      <circle cx={ghostX} cy={ghostY} r={STROKE_WIDTH / 2} className="fill-surface" />
      <text
        x="90"
        y="84"
        textAnchor="middle"
        className="fill-text text-2xl font-bold"
        style={{ fontSize: '22px' }}
      >
        {Math.round(spentFraction * 100)}%
      </text>
      <text
        x="90"
        y="106"
        textAnchor="middle"
        className="fill-text-muted"
        style={{ fontSize: '11px' }}
      >
        of budget
      </text>
    </svg>
  );
}

export default function Money({ panel }: WidgetComponentProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [setupToken, setSetupToken] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const [defaultBudgetInput, setDefaultBudgetInput] = useState('');
  const [overrideInput, setOverrideInput] = useState('');
  const [paycheckInput, setPaycheckInput] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');
  const [transferInput, setTransferInput] = useState('');

  const {
    data: summary,
    isLoading,
    refetch: refetchSummary,
  } = useWidgetQuery<SpendSummary>(
    ['money-summary'],
    async () => {
      const { data } = await getSummaryMoneySummaryGet({ baseUrl: getRelayUrl() });
      return data as SpendSummary;
    },
    { refresh: panel.refresh ?? '15m' },
  );

  const { data: settings, refetch: refetchSettings } = useWidgetQuery<MoneySettings>(
    ['money-settings'],
    async () => {
      const { data } = await getSettingsMoneySettingsGet({ baseUrl: getRelayUrl() });
      return data as MoneySettings;
    },
    { enabled: showSettings },
  );

  const { data: transactions, refetch: refetchTransactions } = useWidgetQuery<TransactionOut[]>(
    ['money-transactions'],
    async () => {
      const { data } = await getTransactionsMoneyTransactionsGet({ baseUrl: getRelayUrl() });
      return (data as TransactionOut[]) ?? [];
    },
    { enabled: showSettings },
  );

  const isLinked = (summary?.linked_accounts.length ?? 0) > 0;

  async function handleLink() {
    setLinking(true);
    setLinkError(null);
    try {
      const { data, response } = await linkAccountsMoneyLinkPost({
        baseUrl: getRelayUrl(),
        body: { setup_token: setupToken.trim() },
      });
      if (!response?.ok || !data) {
        setLinkError('Failed to link accounts. The setup token may be invalid or expired.');
        return;
      }
      setSetupToken('');
      await Promise.all([refetchSummary(), refetchSettings()]);
    } catch {
      setLinkError('Failed to link accounts. The setup token may be invalid or expired.');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    await unlinkMoneyLinkDelete({ baseUrl: getRelayUrl() });
    await Promise.all([refetchSummary(), refetchSettings()]);
  }

  async function handleSync() {
    await syncNowMoneySyncPost({ baseUrl: getRelayUrl() });
    await Promise.all([refetchSummary(), refetchTransactions()]);
  }

  async function handleToggleExcluded(txn: TransactionOut) {
    await setTransactionExcludedMoneyTransactionsTransactionIdExcludePost({
      baseUrl: getRelayUrl(),
      path: { transaction_id: txn.id },
      body: { excluded: !txn.excluded, reason: txn.excluded ? undefined : 'manual' },
    });
    await Promise.all([refetchTransactions(), refetchSummary()]);
  }

  useEffect(() => {
    if (!settings) return;
    setDefaultBudgetInput(String(settings.default_monthly_budget));
    setOverrideInput(
      settings.current_month_override != null ? String(settings.current_month_override) : '',
    );
    setPaycheckInput(settings.paycheck_strings.join(', '));
    setThresholdInput(
      settings.large_deposit_threshold != null ? String(settings.large_deposit_threshold) : '',
    );
    setTransferInput(settings.transfer_keywords.join(', '));
  }, [settings]);

  function openSettings() {
    setShowSettings(true);
  }

  async function handleModalClose() {
    setShowSettings(false);
    if (!settings) return;

    const mutations: Promise<unknown>[] = [];

    const newDefaultBudget = Number.parseFloat(defaultBudgetInput);
    if (!Number.isNaN(newDefaultBudget) && newDefaultBudget !== settings.default_monthly_budget) {
      mutations.push(
        setDefaultBudgetMoneyBudgetPost({
          baseUrl: getRelayUrl(),
          body: { monthly_budget: newDefaultBudget },
        }),
      );
    }

    const trimmedOverride = overrideInput.trim();
    const newOverride = trimmedOverride === '' ? null : Number.parseFloat(trimmedOverride);
    if (newOverride === null && settings.current_month_override != null) {
      mutations.push(
        clearMonthlyOverrideMoneyBudgetOverrideMonthDelete({
          baseUrl: getRelayUrl(),
          path: { month: currentMonthStr() },
        }),
      );
    } else if (
      newOverride !== null &&
      !Number.isNaN(newOverride) &&
      newOverride !== settings.current_month_override
    ) {
      mutations.push(
        setMonthlyOverrideMoneyBudgetOverridePost({
          baseUrl: getRelayUrl(),
          body: { month: currentMonthStr(), budget: newOverride },
        }),
      );
    }

    const newPaycheckStrings = paycheckInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const trimmedThreshold = thresholdInput.trim();
    const newThreshold = trimmedThreshold === '' ? null : Number.parseFloat(trimmedThreshold);
    const thresholdChanged = newThreshold !== settings.large_deposit_threshold;
    const paycheckChanged = newPaycheckStrings.join(',') !== settings.paycheck_strings.join(',');
    if (
      (thresholdChanged || paycheckChanged) &&
      !(newThreshold !== null && Number.isNaN(newThreshold))
    ) {
      mutations.push(
        setDepositSettingsMoneySettingsDepositsPost({
          baseUrl: getRelayUrl(),
          body: { paycheck_strings: newPaycheckStrings, large_deposit_threshold: newThreshold },
        }),
      );
    }

    const newTransferKeywords = transferInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (newTransferKeywords.join(',') !== settings.transfer_keywords.join(',')) {
      mutations.push(
        setTransferKeywordsMoneySettingsTransfersPost({
          baseUrl: getRelayUrl(),
          body: { transfer_keywords: newTransferKeywords },
        }),
      );
    }

    if (mutations.length === 0) return;

    await Promise.all(mutations);
    await Promise.all([refetchSummary(), refetchSettings()]);
  }

  if (isLoading && !summary) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface text-text">
        <Spinner size="md" />
      </div>
    );
  }

  const diff = summary ? summary.spent_to_date - summary.ghost_to_date : 0;
  const aheadOfGhost = diff > 0;
  const dailyRate =
    summary && summary.days_in_month > 0 ? summary.monthly_budget / summary.days_in_month : 0;
  const daysDelta = dailyRate > 0 ? Math.round(Math.abs(diff) / dailyRate) : 0;

  return (
    <div className="w-full h-full flex flex-col bg-surface text-text p-3 gap-2">
      <div className="flex items-center justify-end shrink-0">
        <div className="flex items-center gap-1.5">
          {summary?.last_sync_error && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openSettings();
              }}
              title={summary.last_sync_error}
            >
              <Badge variant="danger" size="sm">
                sync error
              </Badge>
            </button>
          )}
          {summary?.is_override && (
            <Badge variant="warning" size="sm">
              adjusted
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              openSettings();
            }}
            className="opacity-70 hover:opacity-100"
            title="Settings"
          >
            <Settings size={14} className="text-text-muted" />
          </Button>
        </div>
      </div>

      {!isLinked ? (
        <EmptyState
          title="No accounts linked"
          description="Link SimpleFIN accounts to track spend against your budget."
          action={
            <Button size="sm" onClick={openSettings}>
              Link accounts
            </Button>
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="flex-1 flex flex-col items-center justify-center min-h-0 gap-1 cursor-pointer"
          title={revealed ? 'Tap to hide amounts' : 'Tap to reveal amounts'}
        >
          <div className="flex-1 flex items-center justify-center min-h-0 w-full">
            <SpendDonut
              spent={summary?.spent_to_date ?? 0}
              ghost={summary?.ghost_to_date ?? 0}
              budget={summary?.monthly_budget ?? 0}
            />
          </div>

          {summary &&
            (revealed ? (
              <div className="text-[11px] text-center shrink-0 space-y-0.5">
                <p>
                  <b>{formatMoney(summary.spent_to_date)}</b> ·{' '}
                  <span className="text-text-muted">
                    {formatMoney(summary.ghost_to_date)} ghost
                  </span>
                  {' · '}
                  <span className="text-text-muted">
                    {formatMoney(summary.monthly_budget)} budget
                  </span>
                </p>
                <p className="text-text-muted space-x-1.5">
                  {summary.linked_accounts.map((a) => (
                    <span key={a.id}>
                      {a.name}:{' '}
                      {a.last_transaction_posted
                        ? formatRelativeDate(a.last_transaction_posted)
                        : 'no data'}
                    </span>
                  ))}
                </p>
              </div>
            ) : (
              <p
                className={`text-[11px] text-center shrink-0 ${aheadOfGhost ? 'text-danger' : 'text-success'}`}
              >
                {daysDelta === 0
                  ? 'right on pace'
                  : `${daysDelta} day${daysDelta === 1 ? '' : 's'} ${aheadOfGhost ? 'ahead of' : 'behind'} pace`}
              </p>
            ))}
        </button>
      )}

      <Modal open={showSettings} onClose={handleModalClose} title="Money Settings" wide>
        <div className="space-y-5">
          {!isLinked ? (
            <div className="space-y-2">
              <Input
                label="SimpleFIN setup token"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Paste your one-time setup token"
              />
              {linkError && <p className="text-sm text-danger">{linkError}</p>}
              <Button onClick={handleLink} loading={linking} disabled={!setupToken.trim()}>
                Link accounts
              </Button>
            </div>
          ) : (
            <>
              {summary?.last_sync_error && (
                <Alert variant="error">Last sync failed: {summary.last_sync_error}</Alert>
              )}
              <div>
                <p className="text-sm font-medium text-text-secondary mb-1">Linked accounts</p>
                <ul className="text-sm space-y-0.5">
                  {settings?.linked_accounts.map((a) => (
                    <li key={a.id}>
                      {a.org_name} — {a.name}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-text-secondary">Budget</p>
                <Input
                  label="Default monthly budget"
                  type="number"
                  value={defaultBudgetInput}
                  onChange={(e) => setDefaultBudgetInput(e.target.value)}
                />
                <Input
                  label="This month's budget (override)"
                  type="number"
                  value={overrideInput}
                  onChange={(e) => setOverrideInput(e.target.value)}
                  placeholder="Uses default if empty"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-text-secondary">Deposit alerts</p>
                <Input
                  label="Paycheck match strings (comma-separated)"
                  value={paycheckInput}
                  onChange={(e) => setPaycheckInput(e.target.value)}
                  placeholder="PAYROLL, ACME CORP"
                />
                <Input
                  label="Alert threshold for unexpected deposits"
                  type="number"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  placeholder="Off — no alerts"
                />
                <p className="text-xs text-text-muted">
                  {thresholdInput.trim() === ''
                    ? 'Alerts are off. Set a dollar amount (0 = notify on any deposit).'
                    : `Notifies on unexpected deposits of ${formatMoney(Number.parseFloat(thresholdInput) || 0)} or more.`}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-text-secondary">Transfer detection</p>
                <Input
                  label="Transfer/payment keywords (comma-separated)"
                  value={transferInput}
                  onChange={(e) => setTransferInput(e.target.value)}
                  placeholder="CHASE CARD, AUTOPAY"
                />
              </div>

              {transactions && transactions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-text-secondary">Recent transactions</p>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                    {transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between text-xs gap-2 py-1 border-b border-border last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate">
                            {txn.description || txn.payee}{' '}
                            {txn.is_paycheck && (
                              <Badge variant="info" size="sm">
                                paycheck
                              </Badge>
                            )}
                            {txn.excluded && (
                              <Badge variant="default" size="sm">
                                {txn.exclude_reason ?? 'excluded'}
                              </Badge>
                            )}
                          </p>
                          <p className="text-text-muted">
                            {formatShortDate(txn.posted)} · {txn.account_name} ·{' '}
                            {formatMoney(txn.amount)}
                          </p>
                        </div>
                        <Toggle
                          size="sm"
                          checked={!txn.excluded}
                          onChange={() => handleToggleExcluded(txn)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button size="sm" variant="secondary" onClick={handleSync}>
                  Sync now
                </Button>
                <Button size="sm" variant="danger" onClick={() => setShowUnlinkConfirm(true)}>
                  Unlink
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={showUnlinkConfirm}
        onClose={() => setShowUnlinkConfirm(false)}
        onConfirm={handleUnlink}
        title="Unlink accounts"
        message="This removes the SimpleFIN link and all cached transaction data. This can't be undone."
        confirmText="Unlink"
      />
    </div>
  );
}
