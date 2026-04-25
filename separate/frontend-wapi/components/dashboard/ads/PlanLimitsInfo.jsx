export default function PlanLimitsInfo({ eligibility }) {
  if (!eligibility?.enabled || !eligibility.limits) return null;

  return (
    <div className="mt-8 bg-blue-500/5 border border-blue-200/20 rounded-2xl p-6 sm:p-8">
      <h3 className="font-bold text-blue-600 dark:text-blue-400 text-lg mb-4">Your Plan Limits</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-card/50 border border-border p-4 rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Max Active Ads</p>
          <p className="text-2xl font-extrabold text-foreground">
            {eligibility.limits.maxActiveAds === -1 ? 'Unlimited' : eligibility.limits.maxActiveAds}
          </p>
        </div>
        <div className="bg-card/50 border border-border p-4 rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Monthly Budget Limit</p>
          <p className="text-2xl font-extrabold text-foreground">
            {eligibility.limits.maxMonthlySpend === -1 
              ? 'Unlimited' 
              : `$${(eligibility.limits.maxMonthlySpend / 100).toFixed(0)}`}
          </p>
        </div>
        <div className="bg-card/50 border border-border p-4 rounded-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Concurrent Campaigns</p>
          <p className="text-2xl font-extrabold text-foreground">
            {eligibility.limits.maxConcurrentCampaigns === -1 ? 'Unlimited' : eligibility.limits.maxConcurrentCampaigns}
          </p>
        </div>
      </div>
    </div>
  );
}
