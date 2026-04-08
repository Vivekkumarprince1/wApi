export default function EligibilityBanner({ eligibility }) {
  if (!eligibility || eligibility.enabled) return null;

  return (
    <div className="mb-8 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 sm:p-8">
      <h3 className="font-bold text-amber-600 dark:text-amber-400 text-lg mb-4 flex items-center gap-2">
        <span className="p-1.5 bg-amber-500/10 rounded-lg">⚠️</span>
        Why WhatsApp Ads is not available:
      </h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {eligibility.errors.map((error) => {
          const check = eligibility.checks[error.replace('_LIMIT', '').toLowerCase()];
          return (
            <li key={error} className="bg-card/50 border border-border p-4 rounded-xl">
              <span className="font-bold text-foreground block mb-1">❌ {error.replace(/_/g, ' ')}</span>
              {check?.reason && <p className="text-sm text-muted-foreground">{check.reason}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
