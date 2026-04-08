import { Rocket, FileText, Zap, Users, Clock, ChevronRight, Info } from 'lucide-react';

export default function ReviewStep({
  campaignData,
  audienceCount,
  selectedTemplate,
  templateVariables,
  contactFields
}) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 space-y-5">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" /> Campaign Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Campaign Name', value: campaignData.name, icon: FileText },
            { label: 'Type', value: campaignData.type === 'one-time' ? 'One-Time Broadcast' : 'Ongoing Campaign', icon: Zap },
            { label: 'Recipients', value: `${audienceCount} contact${audienceCount !== 1 ? 's' : ''} (${campaignData.audienceMode === 'all' ? 'All Contacts' : campaignData.audienceMode === 'tags' ? 'Filtered by Tags' : 'CSV Upload'})`, icon: Users },
            { label: 'Template', value: selectedTemplate?.name || 'Not selected', icon: FileText },
            { label: 'Schedule', value: campaignData.scheduleType === 'now' ? 'Send immediately' : `${campaignData.scheduleDate} at ${campaignData.scheduleTime}`, icon: Clock },
            { 
              label: 'Optimization', 
              value: campaignData.deliveryOptimization.enabled 
                ? (campaignData.deliveryOptimization.type === 'RCS_FALLBACK' ? 'RCS Fallback Enabled' : 'Automated Retries Enabled')
                : 'Disabled', 
              icon: Zap 
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3 bg-card/80 rounded-xl border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 break-words">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Tags Display */}
        {campaignData.audienceMode === 'tags' && campaignData.selectedTags.length > 0 && (
          <div className="px-4 py-3 bg-card/80 rounded-xl border border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Selected Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {campaignData.selectedTags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Variable Mapping Summary */}
        {templateVariables.length > 0 && Object.keys(campaignData.variableMapping).length > 0 && (
          <div className="px-4 py-3 bg-card/80 rounded-xl border border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Variable Mapping</p>
            <div className="space-y-1">
              {templateVariables.map(v => (
                <div key={v} className="flex items-center gap-2 text-xs">
                  <code className="text-primary font-bold">{`{{${v}}}`}</code>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground font-medium">
                    {campaignData.variableMapping[v]
                      ? contactFields.find(f => f.value === campaignData.variableMapping[v])?.label || campaignData.variableMapping[v]
                      : 'Not mapped'}
                  </span>
                  {campaignData.variableFallbacks[v] && (
                    <span className="text-muted-foreground">(fallback: {campaignData.variableFallbacks[v]})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {campaignData.description && (
          <div className="px-4 py-3 bg-card/80 rounded-xl border border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-foreground">{campaignData.description}</p>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {campaignData.scheduleType === 'now'
            ? 'Your campaign will start sending within 30–60 seconds after launch.'
            : 'Your campaign will be queued and sent at the scheduled time.'
          }
        </p>
      </div>
    </div>
  );
}
