import { Send, Zap, CheckCircle2 } from 'lucide-react';

export default function DetailsStep({ campaignData, setCampaignData }) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <label className="block text-sm font-bold text-foreground mb-2">
          Campaign Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={campaignData.name}
          onChange={(e) => setCampaignData(d => ({ ...d, name: e.target.value }))}
          placeholder="e.g., Diwali Sale Announcement, Welcome Offer..."
          className="input-premium text-sm w-full"
          autoFocus
        />
        <p className="text-xs text-muted-foreground mt-1.5">Give your campaign a clear, descriptive name for easy identification.</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-foreground mb-2">
          Description <span className="text-muted-foreground font-normal">(Optional)</span>
        </label>
        <textarea
          value={campaignData.description}
          onChange={(e) => setCampaignData(d => ({ ...d, description: e.target.value }))}
          placeholder="Brief description of this campaign's goal..."
          rows={3}
          className="input-premium text-sm w-full resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-foreground mb-3">
          Campaign Type
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { value: 'one-time', label: 'One-Time', desc: 'Send a single broadcast to your audience', icon: Send },
            { value: 'ongoing', label: 'Ongoing', desc: 'Schedule recurring campaign sends', icon: Zap },
          ].map(opt => {
            const Icon = opt.icon;
            const isSelected = campaignData.type === opt.value;
            return (
              <button key={opt.value}
                onClick={() => setCampaignData(d => ({ ...d, type: opt.value }))}
                className={`group relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
