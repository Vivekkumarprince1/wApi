import { FaPlus } from 'react-icons/fa';

export default function AdsHeader({ onCreateAd, eligibilityEnabled }) {
  return (
    <div className="bg-card border-b border-border px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">WhatsApp Ads</h1>
          <p className="text-muted-foreground mt-1">Click-to-Chat campaigns</p>
        </div>
        <button
          onClick={onCreateAd}
          disabled={!eligibilityEnabled}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 ${
            eligibilityEnabled
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          <FaPlus className="h-4 w-4" /> Create Ad
        </button>
      </div>
    </div>
  );
}
