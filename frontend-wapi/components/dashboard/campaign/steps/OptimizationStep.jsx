import { Zap, Clock, Smartphone, CheckCircle2, Info, MessageSquare, AlertTriangle } from 'lucide-react';

export default function OptimizationStep({ campaignData, setCampaignData }) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
        campaignData.deliveryOptimization.enabled 
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
          : 'border-border bg-card'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              campaignData.deliveryOptimization.enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Delivery Optimization</h3>
              <p className="text-xs text-muted-foreground">Maximize your reach with automated failover and retries.</p>
            </div>
          </div>
          <button
            onClick={() => setCampaignData(d => ({
              ...d,
              deliveryOptimization: { ...d.deliveryOptimization, enabled: !d.deliveryOptimization.enabled }
            }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              campaignData.deliveryOptimization.enabled ? 'bg-emerald-500' : 'bg-muted'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              campaignData.deliveryOptimization.enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {campaignData.deliveryOptimization.enabled && (
          <div className="space-y-6 pt-4 border-t border-border/50 animate-fade-in">
            <label className="block text-sm font-bold text-foreground mb-3">Optimization Method</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { 
                  value: 'AUTOMATED_RETRY', 
                  label: 'Automated Retry', 
                  desc: 'Retry via WhatsApp after 24h if Frequency Cap (131051) error occurs.',
                  icon: Clock
                },
                { 
                  value: 'RCS_FALLBACK', 
                  label: 'RCS Fallback', 
                  desc: 'Send via RCS channel if WhatsApp delivery fails for any reason.',
                  icon: Smartphone
                },
              ].map(opt => {
                const isSelected = campaignData.deliveryOptimization.type === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setCampaignData(d => ({
                      ...d,
                      deliveryOptimization: { ...d.deliveryOptimization, type: opt.value }
                    }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/10 shadow-sm' 
                        : 'border-border hover:border-primary/30 bg-card'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                       <div className="flex items-center justify-between">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                           <Icon className="h-4 w-4" />
                         </div>
                         {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                       </div>
                       <div className="font-bold text-sm">{opt.label}</div>
                       <div className="text-[11px] text-muted-foreground leading-relaxed">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {campaignData.deliveryOptimization.type === 'AUTOMATED_RETRY' && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-bold mb-1">How it works:</p>
                  <p>Meta enforces frequency caps. If hit, we wait 24 hours and retry sending the same message automatically. This is ideal for high-volume marketing campaigns.</p>
                </div>
              </div>
            )}

            {campaignData.deliveryOptimization.type === 'RCS_FALLBACK' && (
              <div className="space-y-4 animate-fade-in-up">
                 <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                  <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">
                    <p className="font-bold mb-1">Unified Reach:</p>
                    <p>If WhatsApp is unavailable on the recipient's phone, we'll fallback to RCS (Rich Communication Services) automatically.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-2">Fallback Message Body</label>
                    <textarea 
                      value={campaignData.deliveryOptimization.fallbackBody}
                      onChange={(e) => setCampaignData(d => ({
                        ...d,
                        deliveryOptimization: { ...d.deliveryOptimization, fallbackBody: e.target.value }
                      }))}
                      placeholder="Hi {{firstName}}, check out our sale! (Leave empty to use WhatsApp text)"
                      rows={3}
                      className="input-premium text-sm w-full resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">If empty, we'll use the plain text version of your WhatsApp template.</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-600 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Cascade to SMS</p>
                        <p className="text-[10px] text-muted-foreground">If RCS also fails, send as a plain SMS message.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCampaignData(d => ({
                        ...d,
                        deliveryOptimization: { ...d.deliveryOptimization, cascadetoSms: !d.deliveryOptimization.cascadetoSms }
                      }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        campaignData.deliveryOptimization.cascadetoSms ? 'bg-orange-500' : 'bg-muted'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        campaignData.deliveryOptimization.cascadetoSms ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 italic">
                Note: Delivery optimization requires a pre-paid wallet balance. Credits will be "parked" when the campaign starts.
              </p>
            </div>
          </div>
        )}
      </div>

      {!campaignData.deliveryOptimization.enabled && (
        <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-10 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Delivery optimization is disabled for this campaign.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Standard WhatsApp delivery logic will be applied.</p>
        </div>
      )}
    </div>
  );
}
