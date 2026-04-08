import { Rocket, Calendar, CheckCircle2 } from 'lucide-react';

export default function ScheduleStep({ campaignData, setCampaignData }) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { value: 'now', label: 'Send Now', desc: 'Launch campaign immediately', icon: Rocket, color: 'emerald' },
          { value: 'later', label: 'Schedule for Later', desc: 'Pick a date and time', icon: Calendar, color: 'blue' },
        ].map(opt => {
          const Icon = opt.icon;
          const isSelected = campaignData.scheduleType === opt.value;
          return (
            <button key={opt.value}
              onClick={() => setCampaignData(d => ({ ...d, scheduleType: opt.value }))}
              className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                : 'border-border hover:border-primary/40 hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-foreground">{opt.label}</div>
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

      {campaignData.scheduleType === 'later' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up">
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">Date</label>
            <input
              type="date"
              value={campaignData.scheduleDate}
              onChange={(e) => setCampaignData(d => ({ ...d, scheduleDate: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className="input-premium text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">Time</label>
            <input
              type="time"
              value={campaignData.scheduleTime}
              onChange={(e) => setCampaignData(d => ({ ...d, scheduleTime: e.target.value }))}
              className="input-premium text-sm w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
