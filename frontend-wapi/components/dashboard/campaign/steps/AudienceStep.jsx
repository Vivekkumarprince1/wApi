import { Users, Tag, FileUp, CheckCircle2, Loader2, UserCheck, Filter, Upload, X } from 'lucide-react';

export default function AudienceStep({ 
  campaignData, 
  setCampaignData, 
  contacts, 
  contactCount, 
  loadingContacts, 
  tags, 
  loadingTags, 
  filteredContactCount, 
  handleCSVUpload, 
  audienceCount,
  segments = [],
  loadingSegments = false
}) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Audience Mode Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { value: 'specific', label: 'Contacts', desc: `Select specific`, icon: Users, color: 'blue' },
          { value: 'tags', label: 'By Tags', desc: 'Target tags', icon: Tag, color: 'purple' },
          { value: 'segment', label: 'Segment', desc: 'Saved groups', icon: Filter, color: 'amber' },
          { value: 'csv', label: 'CSV', desc: 'Upload file', icon: FileUp, color: 'emerald' },
        ].map(opt => {
          const Icon = opt.icon;
          const isSelected = campaignData.audienceMode === opt.value;
          return (
            <button key={opt.value}
              onClick={() => setCampaignData(d => ({ ...d, audienceMode: opt.value, selectedTags: [], csvContacts: [], segmentId: null }))}
              className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                : 'border-border hover:border-primary/40 hover:bg-accent/50'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-[13px] text-foreground leading-tight">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Specific Contacts UI */}
      {campaignData.audienceMode === 'specific' && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Target Contacts
            </h4>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={campaignData.selectAllContacts}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCampaignData(d => ({
                    ...d,
                    selectAllContacts: checked,
                    selectedContactIds: checked ? contacts.map(c => c._id || c.id) : []
                  }));
                }}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary transition-all cursor-pointer"
              />
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Select All ({contactCount})</span>
            </label>
          </div>

          {!campaignData.selectAllContacts && (
            <div className="border border-border rounded-lg bg-card max-h-[300px] overflow-y-auto">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No contacts found</div>
              ) : (
                <div className="divide-y divide-border">
                  {contacts.map(contact => {
                    const id = contact._id || contact.id;
                    const isSelected = campaignData.selectedContactIds.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setCampaignData(d => ({
                              ...d,
                              selectedContactIds: e.target.checked 
                                ? [...d.selectedContactIds, id]
                                : d.selectedContactIds.filter(cid => cid !== id)
                            }));
                          }}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">{contact.name || 'Unknown Name'}</span>
                          <span className="text-xs text-muted-foreground">{contact.phone}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
            <UserCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">{audienceCount}</span>
            <span className="text-sm text-foreground">contacts selected</span>
          </div>
        </div>
      )}

      {/* Tag Filter UI */}
      {campaignData.audienceMode === 'tags' && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filter by Tags
            </h4>
            {campaignData.selectedTags.length > 0 && (
              <button onClick={() => setCampaignData(d => ({ ...d, selectedTags: [] }))}
                className="text-xs text-destructive hover:underline">Clear All</button>
            )}
          </div>

          {loadingTags ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tags...
            </div>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No tags found. Create tags in Contacts first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const tagName = typeof tag === 'string' ? tag : tag.name;
                const isSelected = campaignData.selectedTags.includes(tagName);
                return (
                  <button key={tagName}
                    onClick={() => {
                      setCampaignData(d => ({
                        ...d,
                        selectedTags: isSelected
                          ? d.selectedTags.filter(t => t !== tagName)
                          : [...d.selectedTags, tagName]
                      }));
                    }}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-card border-border text-foreground hover:border-primary/40 hover:bg-accent/50'
                    }`}
                  >
                    <Tag className="h-3 w-3 inline mr-1.5 -mt-0.5" />
                    {tagName}
                  </button>
                );
              })}
            </div>
          )}

          {campaignData.selectedTags.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">{filteredContactCount}</span>
              <span className="text-sm text-foreground">contacts match selected tags</span>
            </div>
          )}
        </div>
      )}

      {/* Segment Selection UI */}
      {campaignData.audienceMode === 'segment' && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Select Dynamic Segment
            </h4>
          </div>

          {loadingSegments ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading segments...
            </div>
          ) : segments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No segments found. Create one in the Contacts section first.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {segments.map(seg => {
                const isSelected = campaignData.segmentId === seg._id;
                return (
                  <button key={seg._id}
                    onClick={() => {
                      setCampaignData(d => ({
                        ...d,
                        segmentId: isSelected ? null : seg._id
                      }));
                    }}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${isSelected
                      ? 'bg-primary/5 border-primary shadow-inner'
                      : 'bg-card border-border hover:border-primary/40 hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{seg.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-black mt-0.5">{seg.contactCount || 0} Contacts</div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CSV Upload UI */}
      {campaignData.audienceMode === 'csv' && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Upload Contacts CSV
          </h4>

          {campaignData.csvContacts.length === 0 ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-10 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-all group">
              <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-all">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground">Must include a "phone" column.</p>
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-bold text-foreground">{campaignData.csvContacts.length} contacts loaded</span>
                </div>
                <button onClick={() => setCampaignData(d => ({ ...d, csvContacts: [] }))}
                  className="text-xs text-destructive hover:underline flex items-center gap-1">
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audience Summary */}
      {audienceCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {audienceCount} recipient{audienceCount !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}
    </div>
  );
}
