import { Search, Loader2, FileText, CheckCircle2, Zap } from 'lucide-react';

export default function MessageStep({
  templateSearch,
  setTemplateSearch,
  loadingTemplates,
  filteredTemplates,
  campaignData,
  setCampaignData,
  selectedTemplate,
  templateVariables,
  contactFields
}) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Template Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          placeholder="Search approved templates..."
          className="input-premium pl-10 text-sm w-full"
        />
      </div>

      {loadingTemplates ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No Approved Templates</p>
          <p className="text-xs text-muted-foreground">Create and approve templates before creating a campaign.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredTemplates.map(template => {
            const tId = template._id || template.id;
            const isSelected = campaignData.templateId === tId;
            return (
              <button key={tId}
                onClick={() => setCampaignData(d => ({
                  ...d,
                  templateId: tId,
                  variableMapping: {},
                  variableFallbacks: {},
                }))}
                className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-foreground truncate">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.bodyText || template.body}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                      template.category === 'MARKETING'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : template.category === 'UTILITY'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-muted text-muted-foreground'
                    }`}>{template.category}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Variable Mapping Section */}
      {selectedTemplate && templateVariables.length > 0 && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Map Template Variables
          </h4>
          <p className="text-xs text-muted-foreground">
            Map each variable in the template to a contact field. Set fallback text if a contact lacks the field.
          </p>

          <div className="space-y-3">
            {templateVariables.map((varName, i) => (
              <div key={varName} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-lg">
                  <code className="text-xs font-bold text-primary">{`{{${varName}}}`}</code>
                </div>
                <select
                  value={campaignData.variableMapping[varName] || ''}
                  onChange={(e) => setCampaignData(d => ({
                    ...d,
                    variableMapping: { ...d.variableMapping, [varName]: e.target.value }
                  }))}
                  className="input-premium text-sm"
                >
                  <option value="">Select field...</option>
                  {contactFields.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Fallback value..."
                  value={campaignData.variableFallbacks[varName] || ''}
                  onChange={(e) => setCampaignData(d => ({
                    ...d,
                    variableFallbacks: { ...d.variableFallbacks, [varName]: e.target.value }
                  }))}
                  className="input-premium text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Preview */}
      {selectedTemplate && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 animate-fade-in-up">
          <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Message Preview
          </h4>
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {(() => {
                let text = selectedTemplate.bodyText || selectedTemplate.body || '';
                templateVariables.forEach(v => {
                  const mappedField = campaignData.variableMapping[v];
                  const fallback = campaignData.variableFallbacks[v] || `[${v}]`;
                  const label = contactFields.find(f => f.value === mappedField)?.label || fallback;
                  text = text.replace(`{{${v}}}`, `[${label}]`);
                });
                return text;
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
