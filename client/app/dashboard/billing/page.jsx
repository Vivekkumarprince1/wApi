'use client';

import { useEffect, useState } from 'react';
import { getCurrentMonthBilling, getQuotaReport, getBillingPreview } from '@/lib/api';

export default function BillingDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(null);
  const [quota, setQuota] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const [monthRes, quotaRes] = await Promise.all([
          getCurrentMonthBilling().catch(() => null),
          getQuotaReport().catch(() => null)
        ]);

        setCurrentMonth(monthRes?.data || null);
        setQuota(quotaRes?.data || null);

        // Optional billing preview using conversation ledger
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = now.toISOString();
        const previewRes = await getBillingPreview({ startDate: start, endDate: end }).catch(() => null);
        setPreview(previewRes?.data || null);
      } catch (err) {
        console.error('Billing load failed', err);
        setError(err.message || 'Failed to load billing data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const quotaPercentage = quota?.percentage ?? null;

  return (
    <div className=" p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing & Usage</h1>
            <p className="text-sm text-muted-foreground">
              Meta-aligned conversation usage under our BSP account.
            </p>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Quota summary */}
            <div className="rounded-xl bg-white p-5 shadow-premium dark:bg-card md:col-span-1">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Monthly conversation quota
              </h2>
              {quota ? (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {quota.used} / {quota.limit}{' '}
                    <span className="text-sm font-normal text-muted-foreground">conversations</span>
                  </p>
                  {typeof quotaPercentage === 'number' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quotaPercentage}% of monthly allowance used
                    </p>
                  )}
                  <div className="mt-3 h-2 w-full rounded-full bg-border dark:bg-muted">
                    <div
                      className={`h-2 rounded-full ${
                        quota.isBlocked
                          ? 'bg-red-500'
                          : quota.isWarning
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(quotaPercentage || 0, 100)}%` }}
                    />
                  </div>
                  {quota.isBlocked ? (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      Sending is blocked. Please upgrade your plan to continue.
                    </p>
                  ) : quota.isWarning ? (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      You are close to your monthly limit. Consider upgrading your plan.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Quota details are not available for this workspace.
                </p>
              )}
            </div>

            {/* Conversation usage */}
            <div className="rounded-xl bg-white p-5 shadow-premium dark:bg-card md:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Current month conversations
              </h2>
              {currentMonth ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    label="Total conversations"
                    value={currentMonth.totalConversations || 0}
                  />
                  <StatCard
                    label="Template conversations"
                    value={currentMonth.templateConversations || 0}
                  />
                  <StatCard
                    label="Free/service conversations"
                    value={currentMonth.freeConversations || 0}
                  />
                  <StatCard
                    label="Total messages"
                    value={currentMonth.totalMessages || 0}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No billing data for the current month yet.
                </p>
              )}
            </div>

            {/* Estimated cost (simple preview) */}
            <div className="rounded-xl bg-white p-5 shadow-premium dark:bg-card md:col-span-3">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Estimated Meta cost (preview)
              </h2>
              {preview ? (
                <div className="flex flex-wrap items-baseline gap-2">
                  {preview.amountUSD !== undefined ? (
                    <>
                      <span className="text-3xl font-bold text-foreground">
                        ${preview.amountUSD}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        estimated for this period (conversation-based)
                      </span>
                    </>
                  ) : (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background p-3 text-xs text-gray-100">
                      {JSON.stringify(preview, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cost preview is not available yet for this workspace.
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                All conversations are initiated under our BSP-owned Meta assets. Meta bills us,
                and we pass through charges to your workspace based on these units.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-muted p-4 text-sm dark:border-border dark:bg-gray-900/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

