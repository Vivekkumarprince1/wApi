"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Tag as TagIcon, 
  LayoutGrid, 
  Upload, 
  Search, 
  CheckCircle2, 
  X,
  FileSpreadsheet,
  Users2,
  Filter,
  UtensilsCrossed,
  FileUp
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchContacts, fetchTags, fetchSegments } from '@/lib/api/contacts';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';

interface AudienceStepProps {
  campaignData: any;
  setCampaignData: (data: any) => void;
}

export default function AudienceStep({ campaignData, setCampaignData }: AudienceStepProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', 1, 100],
    queryFn: () => fetchContacts(1, 100)
  });

  const { data: tagsData, isLoading: loadingTags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => fetchTags()
  });

  const { data: segmentsData, isLoading: loadingSegments } = useQuery({
    queryKey: ['segments'],
    queryFn: () => fetchSegments()
  });

  const [showMore, setShowMore] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    
    try {
      // Small delay to allow UI to show loading state
      await new Promise(resolve => setTimeout(resolve, 10));

      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('The file is empty');
        setIsParsing(false);
        return;
      }
      
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
      const phoneIndex = headers.indexOf('phone');
      const nameIndex = headers.indexOf('name');
      const emailIndex = headers.indexOf('email');
      
      if (phoneIndex === -1) {
        toast.error('CSV must have a "phone" column');
        setIsParsing(false);
        return;
      }

      // Efficient parsing for large files
      const contacts: any[] = [];
      const len = lines.length;
      for (let i = 1; i < len; i++) {
        const line = lines[i];
        if (!line) continue;
        
        const values = line.split(delimiter);
        const phone = values[phoneIndex]?.trim().replace(/["']/g, '');
        
        if (phone && phone.length > 5) {
          contacts.push({
            phone,
            name: nameIndex !== -1 ? values[nameIndex]?.trim().replace(/["']/g, '') || 'Valued Customer' : 'Valued Customer',
            email: emailIndex !== -1 ? values[emailIndex]?.trim().replace(/["']/g, '') || '' : ''
          });
        }
      }

      if (contacts.length === 0) {
        toast.error('No valid contacts found');
        setIsParsing(false);
        return;
      }

      setCampaignData({ 
        ...campaignData, 
        csvContacts: contacts, 
        audienceMode: 'csv' 
      });
      
      toast.success(`Instantly parsed ${contacts.length} contacts`);
    } catch (err: any) {
      toast.error('Failed to parse CSV');
    } finally {
      setIsParsing(false);
    }
  };

  const primaryModes = [
    { id: 'specific', label: 'Contacts', icon: Users2 },
    { id: 'tags', label: 'Tags', icon: TagIcon },
    { id: 'csv', label: 'CSV Upload', icon: FileUp },
  ];

  const secondaryModes = [
    { id: 'segment', label: 'Segments', icon: LayoutGrid },
    { id: 'google_sheets', label: 'FileSpreadsheet', icon: FileSpreadsheet },
    { id: 'petpooja', label: 'Petpooja', icon: UtensilsCrossed },
  ];

  const allModes = [...primaryModes, ...secondaryModes];
  const isSecondaryActive = secondaryModes.some(m => m.id === campaignData.audienceMode);

  const contacts = contactsData?.data || contactsData?.contacts || [];
  const tags = tagsData?.tags || tagsData?.data || tagsData || [];
  const segments = segmentsData?.segments || segmentsData?.data || segmentsData || [];

  const filteredContacts = contacts.filter((c: any) => 
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)) &&
    !!c.phone // Guardrail: Only show contacts with reachable phone numbers
  );

  const toggleContact = (id: string) => {
    const selected = [...campaignData.selectedContactIds];
    const index = selected.indexOf(id);
    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(id);
    }
    setCampaignData({ ...campaignData, selectedContactIds: selected, selectAllContacts: false });
  };

  const toggleTag = (tag: string) => {
    const selected = [...campaignData.selectedTags];
    const index = selected.indexOf(tag);
    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(tag);
    }
    setCampaignData({ ...campaignData, selectedTags: selected });
  };

  const handleModeChange = (mode: string) => {
    setCampaignData({ ...campaignData, audienceMode: mode });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {primaryModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              className={`
                flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all
                ${campaignData.audienceMode === mode.id 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20 scale-105' 
                  : 'border-border/50 hover:border-border text-muted-foreground'}
              `}
            >
              <mode.icon className={`h-5 w-5 ${campaignData.audienceMode === mode.id ? 'text-primary' : ''}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${campaignData.audienceMode === mode.id ? 'text-primary' : ''}`}>
                {mode.label}
              </span>
            </button>
          ))}
          
          <button
            onClick={() => setShowMore(!showMore)}
            className={`
              flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all
              ${(showMore || isSecondaryActive) 
                ? 'border-primary/40 bg-primary/5' 
                : 'border-border/50 hover:border-border text-muted-foreground'}
            `}
          >
            <LayoutGrid className={`h-5 w-5 ${(showMore || isSecondaryActive) ? 'text-primary' : ''}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${(showMore || isSecondaryActive) ? 'text-primary' : ''}`}>
              {showMore ? 'Less Options' : 'More...'}
            </span>
          </button>
        </div>

        <AnimatePresence>
          {(showMore || isSecondaryActive) && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {secondaryModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleModeChange(mode.id)}
                    className={`
                      flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all
                      ${campaignData.audienceMode === mode.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20 scale-105' 
                        : 'border-border/20 hover:border-border/40 text-muted-foreground/60 bg-muted/5'}
                    `}
                  >
                    <mode.icon className={`h-4 w-4 ${campaignData.audienceMode === mode.id ? 'text-primary' : ''}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${campaignData.audienceMode === mode.id ? 'text-primary' : ''}`}>
                      {mode.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-muted/10 border border-border/50 rounded-3xl p-6 min-h-[300px]">
        {campaignData.audienceMode === 'google_sheets' && (
           <div className="space-y-6">
             <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/10 rounded-2xl mb-4">
                <Zap className="h-5 w-5 text-primary fill-primary/20" />
                <div>
                   <p className="text-xs font-bold text-foreground">Direct Sync</p>
                   <p className="text-[10px] text-muted-foreground font-medium">Broadcast to all rows in your sheet. New contacts will be created automatically.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Spreadsheet</Label>
                  <SpreadsheetPicker 
                    value={campaignData.googleSheetsConfig?.spreadsheetId} 
                    onChange={(id) => setCampaignData({
                      ...campaignData,
                      googleSheetsConfig: { ...campaignData.googleSheetsConfig, spreadsheetId: id, sheetName: '' }
                    })} 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Worksheet</Label>
                  <SheetPicker 
                    spreadsheetId={campaignData.googleSheetsConfig?.spreadsheetId}
                    value={campaignData.googleSheetsConfig?.sheetName}
                    onChange={(name) => setCampaignData({
                      ...campaignData,
                      googleSheetsConfig: { ...campaignData.googleSheetsConfig, sheetName: name }
                    })}
                  />
                </div>
             </div>
           </div>
        )}

        {campaignData.audienceMode === 'specific' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search your contacts..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-background border-border/50"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl font-bold h-10 px-4"
                onClick={() => setCampaignData({ 
                   ...campaignData, 
                   selectAllContacts: !campaignData.selectAllContacts,
                   selectedContactIds: !campaignData.selectAllContacts ? contacts.map((c: any) => c._id) : []
                })}
              >
                {campaignData.selectAllContacts ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <ScrollArea className="h-64 rounded-xl border border-border/50 bg-background/50 p-2">
              {loadingContacts ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredContacts.map((contact: any) => (
                    <div 
                      key={contact._id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => toggleContact(contact._id)}
                    >
                      <Checkbox 
                        checked={campaignData.selectAllContacts || campaignData.selectedContactIds.includes(contact._id)}
                        onCheckedChange={() => toggleContact(contact._id)}
                        className="rounded-sm"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold group-hover:text-primary transition-colors">{contact.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{contact.phone}</span>
                      </div>
                    </div>
                  ))}
                  {filteredContacts.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground font-medium italic">No contacts match your search</div>
                  )}
                </div>
              )}
            </ScrollArea>
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                {campaignData.selectAllContacts ? 'All' : campaignData.selectedContactIds.length} Contacts Selected
              </span>
            </div>
          </div>
        )}

        {campaignData.audienceMode === 'tags' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filter by Tags</Label>
              <div className="flex flex-wrap gap-2">
                {loadingTags ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : tags.map((tag: any) => (
                  <Badge 
                    key={tag.name}
                    variant={campaignData.selectedTags.includes(tag.name) ? "default" : "outline"}
                    className={`
                      px-4 py-1.5 rounded-xl cursor-pointer text-[11px] font-bold uppercase tracking-tight transition-all
                      ${campaignData.selectedTags.includes(tag.name) ? 'shadow-premium-sm' : 'hover:bg-muted'}
                    `}
                    onClick={() => toggleTag(tag.name)}
                  >
                    <TagIcon className="h-3 w-3 mr-2 opacity-60" />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center gap-4">
               <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                 <Filter className="h-5 w-5" />
               </div>
               <div>
                  <p className="text-xs font-bold text-foreground">Smart Filtering</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Campaign will target anyone matching ANY of the selected tags.</p>
               </div>
            </div>
          </div>
        )}

        {campaignData.audienceMode === 'segment' && (
          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select a Segment</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {loadingSegments ? (
                [1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
              ) : segments.map((seg: any) => (
                <div 
                  key={seg._id}
                  onClick={() => setCampaignData({ ...campaignData, segmentId: seg._id })}
                  className={`
                    p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-2 relative overflow-hidden
                    ${campaignData.segmentId === seg._id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 hover:border-border'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm tracking-tight">{seg.name}</span>
                    <Badge variant="outline" className="text-[9px] font-black h-5">{seg.contactCount || 0} Members</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{seg.description || 'Dynamic segment group'}</p>
                  {campaignData.segmentId === seg._id && (
                    <div className="absolute top-[-10px] right-[-10px] h-10 w-10 bg-primary/10 rotate-45" />
                  )}
                </div>
              ))}
              {segments.length === 0 && !loadingSegments && (
                <div className="col-span-2 py-10 text-center text-sm text-muted-foreground font-medium italic">No segments found</div>
              )}
            </div>
          </div>
        )}

        {campaignData.audienceMode === 'petpooja' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-5 bg-orange-500/5 border border-orange-500/10 rounded-3xl">
              <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black uppercase tracking-tight text-orange-900 dark:text-orange-100">Petpooja Sync Active</h4>
                <p className="text-[10px] text-orange-800/70 dark:text-orange-200/50 font-medium">Automatically target customers from your recent Petpooja orders.</p>
              </div>
              <Badge className="bg-orange-500 text-white border-transparent">Live Sync</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-4 rounded-2xl border border-border/50 bg-background/50 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sync Strategy</p>
                  <p className="text-xs font-bold text-foreground">Last 30 Days Customers</p>
                  <p className="text-[10px] text-muted-foreground font-medium italic">Broadcast will be sent to all unique customers who ordered in the last 30 days.</p>
               </div>
               <div className="p-4 rounded-2xl border border-border/50 bg-background/50 space-y-2 flex flex-col justify-center items-center text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimated Audience</p>
                  <p className="text-xl font-black text-primary">~ 1,240</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Updating in real-time</p>
               </div>
            </div>
          </div>
        )}
        {campaignData.audienceMode === 'csv' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            <div className="h-24 w-24 rounded-[2rem] bg-primary/5 flex items-center justify-center text-primary border-2 border-dashed border-primary/20 group hover:bg-primary/10 transition-all cursor-pointer relative shadow-inner">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept=".csv" 
                  onChange={handleFileChange}
                />
                {isParsing ? (
                   <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
                     <Loader2 className="h-10 w-10 text-primary animate-spin" />
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">Scanning File...</p>
                   </div>
                ) : campaignData.csvContacts?.length > 0 ? (
                 <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-in zoom-in duration-300" />
               ) : (
                 <FileUp className="h-10 w-10 opacity-40 group-hover:opacity-100 transition-all group-hover:scale-110" />
               )}
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-sm font-black uppercase tracking-widest">
                {campaignData.csvContacts?.length > 0 ? 'File Loaded Successfully' : 'Upload CSV File'}
              </h3>
              <p className="text-[10px] text-muted-foreground max-w-xs font-medium leading-relaxed">
                {campaignData.csvContacts?.length > 0 
                  ? `Found ${campaignData.csvContacts.length} valid contacts. Review the list below.`
                  : "Please ensure your CSV contains a \"phone\" column. First row should be headers."}
              </p>
            </div>

            {campaignData.csvContacts?.length > 0 && (
              <div className="w-full space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="rounded-2xl border border-border/50 bg-background/50 overflow-hidden shadow-inner">
                  <ScrollArea className="h-48">
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b border-border/40 z-10">
                        <tr>
                          <th className="p-3 font-black uppercase tracking-widest text-muted-foreground">Name</th>
                          <th className="p-3 font-black uppercase tracking-widest text-muted-foreground">Phone</th>
                          <th className="p-3 font-black uppercase tracking-widest text-muted-foreground">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {campaignData.csvContacts.map((contact: any, idx: number) => (
                          <tr key={idx} className="hover:bg-primary/5 transition-colors group">
                            <td className="p-3 font-bold text-foreground group-hover:text-primary">{contact.name}</td>
                            <td className="p-3 font-mono text-muted-foreground">{contact.phone}</td>
                            <td className="p-3 text-muted-foreground italic">{contact.email || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
                
                <div className="flex justify-center">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-[10px] font-black uppercase tracking-widest text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl px-4"
                    onClick={() => setCampaignData({ ...campaignData, csvContacts: [] })}
                  >
                    Remove File & Upload New
                  </Button>
                </div>
              </div>
            )}

            {!(campaignData.csvContacts?.length > 0) && (
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl px-10 h-11 font-black border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-premium-sm"
              >
                Choose File
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components for Google Sheets picking
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';
import { Zap } from 'lucide-react';

function SpreadsheetPicker({ value, onChange }: { value: string, onChange: (id: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['google-spreadsheets'],
    queryFn: async () => {
      const resp = await axios.get('/api/integrations/google/spreadsheets');
      return resp.data.files || [];
    }
  });

  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger className="h-12 bg-background border-border/50 rounded-xl">
        <SelectValue placeholder={isLoading ? "Loading..." : "Choose Spreadsheet"} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {data?.map((f: any) => (
          <SelectItem key={f.id} value={f.id} className="rounded-lg">{f.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SheetPicker({ spreadsheetId, value, onChange }: { spreadsheetId: string, value: string, onChange: (name: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['google-sheets', spreadsheetId],
    queryFn: async () => {
      if (!spreadsheetId) return [];
      const resp = await axios.get(`/api/integrations/google/spreadsheets/${spreadsheetId}/sheets`);
      return resp.data.sheets || [];
    },
    enabled: !!spreadsheetId
  });

  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading || !spreadsheetId}>
      <SelectTrigger className="h-12 bg-background border-border/50 rounded-xl">
        <SelectValue placeholder={isLoading ? "Loading..." : spreadsheetId ? "Choose Worksheet" : "Select Spreadsheet First"} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {data?.map((s: string) => (
          <SelectItem key={s} value={s} className="rounded-lg">{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
