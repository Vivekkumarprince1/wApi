export function resolveBillingPlan<T>(workspacePlan: T | null, subscriptionPlan: T | null): T | null {
  return workspacePlan || subscriptionPlan;
}

export function buildSubscriptionActivation(planId: unknown, billingIntervalMonths = 1, now = new Date()) {
  const periodEnd = new Date(now);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + Math.max(1, billingIntervalMonths));

  return {
    planId,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    lastPaymentAt: now,
    nextBillingAt: periodEnd,
  };
}
