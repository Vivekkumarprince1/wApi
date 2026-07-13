"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Search, 
  User, 
  DollarSign, 
  Target, 
  Zap,
  CheckCircle2,
  Phone,
  MessageSquare
} from 'lucide-react';
import { fetchContacts } from '@/lib/api/contacts';
import { createDeal, updateDeal, Pipeline, Deal } from '@/lib/api/crm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FlashLoader from '@/components/ui/flash-loader';

interface DealDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pipelines: Pipeline[];
  deal?: Deal; // If provided, we are editing
  contact?: any; // If provided, we are creating for this specific contact
}

export const DealDialog: React.FC<DealDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  pipelines, 
  deal,
  contact
}) => {
  const isEditing = !!deal;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    value: 0,
    currency: 'USD',
    pipelineId: '',
    stageId: '',
    priority: 'medium',
    contactId: ''
  });

  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        value: deal.value,
        currency: deal.currency,
        pipelineId: typeof deal.pipeline === 'string' ? deal.pipeline : deal.pipeline?._id || '',
        stageId: deal.stage,
        priority: deal.priority,
        contactId: deal.contact?._id || ''
      });
      setSelectedContact(deal.contact);
    } else if (contact) {
      setFormData({
        title: `${contact.name || contact.phone}'s Deal`,
        value: 0,
        currency: 'USD',
        pipelineId: pipelines[0]?._id || '',
        stageId: pipelines[0]?.stages[0]?.id || '',
        priority: 'medium',
        contactId: contact._id || ''
      });
      setSelectedContact(contact);
    } else {
      setFormData({
        title: '',
        value: 0,
        currency: 'USD',
        pipelineId: pipelines[0]?._id || '',
        stageId: pipelines[0]?.stages[0]?.id || '',
        priority: 'medium',
        contactId: ''
      });
      setSelectedContact(null);
    }
  }, [deal, contact, pipelines, isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (contactSearch.length > 2) {
        searchContacts();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [contactSearch]);

  async function searchContacts() {
    setIsSearchingContacts(true);
    try {
      const res = await fetchContacts(1, 10, { search: contactSearch });
      setContacts(res.data || []);
    } catch (err) {
      console.error("Contact search error", err);
    } finally {
      setIsSearchingContacts(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || (!isEditing && !formData.contactId)) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing) {
        await updateDeal(deal._id, formData);
        toast.success("Deal updated successfully");
      } else {
        await createDeal(formData);
        toast.success("Deal created successfully");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save deal");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPipeline = pipelines.find(p => p._id === formData.pipelineId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tight text-foreground">
                {isEditing ? 'Edit Deal Details' : 'Initialize New Deal'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium">
                {isEditing ? 'Refine the parameters of your current negotiation.' : 'Capture lead details to start your sales sequence.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6">
              {/* Title Section */}
              <div className="space-y-3">
                <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Deal Title</Label>
                <div className="relative group">
                   <Target className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                   <Input 
                    id="title"
                    placeholder="e.g. Enterprise Cloud License"
                    className="h-12 pl-11 rounded-2xl bg-card border-border/40 font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                   />
                </div>
              </div>

              {/* Contact Selector (Only for Create) */}
              {!isEditing && (
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Associated Contact</Label>
                  <div className="relative">
                    {!selectedContact ? (
                      <div className="space-y-2">
                        <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                          <Input 
                            placeholder="Search contacts by name or phone..."
                            className="h-12 pl-11 rounded-2xl bg-card border-border/40 font-bold"
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                          />
                        </div>
                        {contacts.length > 0 && (
                          <div className="bg-background border border-border/40 rounded-2xl shadow-premium-lg overflow-hidden max-h-40 overflow-y-auto">
                            {contacts.map(c => (
                              <button
                                key={c._id}
                                type="button"
                                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border/10 last:border-none"
                                onClick={() => {
                                  setSelectedContact(c);
                                  setFormData({ ...formData, contactId: c._id });
                                  setContacts([]);
                                  setContactSearch('');
                                }}
                              >
                                <Avatar className="size-8 rounded-lg">
                                  <AvatarImage src={c.avatar} />
                                  <AvatarFallback className="text-[10px] font-black bg-primary/10 text-primary">{c.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                  <p className="text-xs font-black leading-none">{c.name}</p>
                                  <p className="text-[10px] font-bold text-muted-foreground mt-1 opacity-60">{c.phone}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                         <div className="flex items-center gap-3">
                            <Avatar className="size-10 rounded-xl ring-2 ring-emerald-500/10">
                              <AvatarImage src={selectedContact.avatar} />
                              <AvatarFallback className="bg-emerald-500/20 text-emerald-600 font-black">{selectedContact.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                               <p className="text-sm font-black text-foreground leading-none">{selectedContact.name}</p>
                               <p className="text-[10px] font-bold text-emerald-600/60 mt-1 uppercase tracking-widest">Active Lead Selection</p>
                            </div>
                         </div>
                         <Button 
                           type="button" 
                           variant="ghost" 
                           className="h-8 rounded-lg text-[10px] font-black uppercase text-red-500 hover:text-red-600 hover:bg-red-500/5"
                           onClick={() => {
                             setSelectedContact(null);
                             setFormData({...formData, contactId: ''});
                           }}
                         >
                           Remove
                         </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Value Section */}
                <div className="space-y-3">
                  <Label htmlFor="value" className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Expected Revenue</Label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-40 group-focus-within:text-emerald-500 transition-colors" />
                    <Input 
                      id="value"
                      type="number"
                      className="h-12 pl-11 rounded-2xl bg-card border-border/40 font-bold"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Priority Section */}
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Priority Rank</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-card border-border/40 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                      <SelectItem value="low" className="rounded-xl font-bold py-2.5">Low Priority</SelectItem>
                      <SelectItem value="medium" className="rounded-xl font-bold py-2.5 text-blue-500">Medium Balance</SelectItem>
                      <SelectItem value="high" className="rounded-xl font-bold py-2.5 text-orange-500">High Stakes</SelectItem>
                      <SelectItem value="urgent" className="rounded-xl font-bold py-2.5 text-red-500">Urgent Close</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pipeline & Stage (Only show stage if pipeline is selected) */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Pipeline</Label>
                    <Select 
                      value={formData.pipelineId} 
                      onValueChange={(v) => {
                        const pipe = pipelines.find(p => p._id === v);
                        setFormData({ 
                          ...formData, 
                          pipelineId: v, 
                          stageId: pipe?.stages[0]?.id || '' 
                        });
                      }}
                    >
                      <SelectTrigger className="h-12 rounded-2xl bg-card border-border/40 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                        {pipelines.map(p => (
                          <SelectItem key={p._id} value={p._id} className="rounded-xl font-bold py-2.5">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 px-1">Initial Stage</Label>
                    <Select 
                      value={formData.stageId} 
                      onValueChange={(v) => setFormData({ ...formData, stageId: v })}
                      disabled={!selectedPipeline}
                    >
                      <SelectTrigger className="h-12 rounded-2xl bg-card border-border/40 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/40 p-2 shadow-premium-lg">
                        {selectedPipeline?.stages.map(s => (
                          <SelectItem key={s.id} value={s.id} className="rounded-xl font-bold py-2.5">{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/10 flex items-center justify-between gap-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                className="h-14 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-muted/50"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="h-14 flex-[2] rounded-[24px] bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/25 gap-2"
              >
                {isLoading ? <FlashLoader /> : isEditing ? 'Update Negotiation' : 'Seal the Deal'}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
