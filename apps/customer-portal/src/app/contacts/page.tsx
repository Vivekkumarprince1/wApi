"use client";

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  MoreVertical, 
  Tag, 
  User as UserIcon,
  Phone,
  Mail,
  MoreHorizontal,
  Plus,
  Trash2,
  RefreshCcw,
  CloudDownload,
  Eye,
  Edit2,
  MessageSquare,
  Calendar,
  Sparkles
} from 'lucide-react';
import { 
  format, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  parseISO 
} from 'date-fns';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { bulkDeleteContacts, bulkTagContacts, deleteContact, fetchContacts, Contact, getContactsExportUrl } from '@/lib/api/contacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from "@/components/ui/card";
import FlashLoader from '@/components/ui/flash-loader';
import CreateContactPanel from '@/components/modals/create-contact-panel';
import DirectTemplateModal from '@/components/dashboard/contacts/DirectTemplateModal';

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isSendTemplateOpen, setIsSendTemplateOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const router = useRouter();
  
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => fetchContacts()
  });

  const contacts: Contact[] = contactsData?.data || [];

  const uniqueDates = useMemo(() => {
    const dates = contacts.map(c => format(parseISO(c.createdAt), 'yyyy-MM-dd'));
    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.phone.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (!selectedDate) return true;

      const createdAtDate = format(parseISO(c.createdAt), 'yyyy-MM-dd');
      return createdAtDate === selectedDate;
    });
  }, [contacts, search, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedContacts = useMemo(
    () => filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredContacts, currentPage]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map(c => c._id));
    }
  };
  
  const handleOpenSendTemplate = (contact: Contact) => {
    setSelectedContact(contact);
    setIsSendTemplateOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setIsAddContactOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      toast.success('Contact deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete contact');
    }
  });

  const handleRemoveContact = (id: string) => {
    if (window.confirm('Are you sure you want to delete this contact? All message history will be removed.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    window.open(getContactsExportUrl(params), '_blank');
  };

  const handleBulkTag = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select contacts first to apply tags');
      return;
    }
    const tag = window.prompt(`Tag to apply to ${selectedIds.length} contact(s):`);
    if (!tag?.trim()) return;
    try {
      const res: any = await bulkTagContacts(selectedIds, [tag.trim()]);
      toast.success(`Tagged ${res?.updated ?? selectedIds.length} contact(s)`);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to tag contacts');
    }
  };

  const handleSyncCrm = async () => {
    await queryClient.invalidateQueries({ queryKey: ['contacts'] });
    toast.success('Contacts refreshed from server');
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select contacts first to delete');
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.length} contact(s)? This cannot be undone.`)) return;
    try {
      const res: any = await bulkDeleteContacts(selectedIds);
      toast.success(`Deleted ${res?.deleted ?? selectedIds.length} contact(s)`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to delete contacts');
    }
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Contacts
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/10">
              {contacts.length} Total
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Manage your audience, segments, and communication history.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsAddContactOpen(true)}
            className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20 bg-primary group"
          >
            <UserPlus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Total Contacts", value: contacts.length, icon: Users, tone: "text-sky-600", bg: "bg-sky-500/10" },
          { label: "Tagged Contacts", value: contacts.filter((c) => c.tags?.length).length, icon: Tag, tone: "text-violet-600", bg: "bg-violet-500/10" },
          { label: "New Leads", value: contacts.filter((c) => c.leadStatus === 'new').length, icon: Sparkles, tone: "text-emerald-600", bg: "bg-emerald-500/10" },
        ].map((item) => (
          <Card key={item.label} className="border-none ring-1 ring-border/50 bg-card shadow-sm rounded-3xl overflow-hidden group hover:ring-primary/20 transition-all duration-300">
            <CardContent className="p-6 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
                <h3 className="text-3xl font-black tracking-tight">{item.value}</h3>
              </div>
              <div className={`h-14 w-14 rounded-2xl ${item.bg} flex items-center justify-center ${item.tone} group-hover:scale-110 transition-transform duration-500`}>
                <item.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Horizontal Date Selector */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
             <Calendar className="h-3 w-3" /> Filter by Save Date
           </h3>
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedDate(null)}
            className="h-7 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary transition-colors"
           >
             Clear Filter
           </Button>
        </div>
        <div className="relative group">
          <div className="overflow-x-auto pb-4 hide-scrollbar flex items-center gap-3">
            <button
              onClick={() => setSelectedDate(null)}
              className={`
                flex-shrink-0 px-6 h-11 rounded-2xl font-bold text-xs uppercase tracking-tight transition-all
                ${!selectedDate 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                  : 'bg-card border border-border/50 text-muted-foreground hover:bg-muted/50 hover:border-primary/20'}
              `}
            >
              All Contacts
            </button>
            {uniqueDates.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`
                  flex-shrink-0 px-6 h-11 rounded-2xl font-bold text-xs uppercase tracking-tight transition-all
                  ${selectedDate === date 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                    : 'bg-card border border-border/50 text-muted-foreground hover:bg-muted/50 hover:border-primary/20'}
                `}
              >
                {format(parseISO(date), 'MMM dd, yyyy')}
              </button>
            ))}
          </div>
          {/* Fading edges for better scroll indication */}
          <div className="absolute top-0 right-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-0 left-0 bottom-4 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full lg:w-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, phone or email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-13 rounded-[20px] bg-card border-border/50 focus-visible:ring-primary/20 shadow-sm font-medium"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <Button variant="outline" onClick={handleExport} className="rounded-xl h-13 px-4 border-border/50 font-bold bg-card shadow-sm">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl h-13 px-4 border-border/50 font-bold bg-card shadow-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50">
               <DropdownMenuItem onClick={handleBulkTag} className="rounded-xl font-bold gap-3 h-11 cursor-pointer"><Tag className="h-4 w-4 text-primary" /> Bulk Tagging</DropdownMenuItem>
               <DropdownMenuItem onClick={handleSyncCrm} className="rounded-xl font-bold gap-3 h-11 cursor-pointer"><RefreshCcw className="h-4 w-4 text-emerald-500" /> Sync with CRM</DropdownMenuItem>
               <DropdownMenuItem onClick={handleBulkDelete} className="rounded-xl font-bold gap-3 h-11 text-destructive focus:bg-destructive/10 cursor-pointer"><Trash2 className="h-4 w-4" /> Delete Selected</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="w-12 px-6">
                  <Checkbox 
                    checked={selectedIds.length === filteredContacts.length && filteredContacts.length > 0} 
                    onCheckedChange={toggleSelectAll}
                    className="rounded-md"
                  />
                </TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Contact Info</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Source / Label</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Tags</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Saved On</TableHead>
                <TableHead className="px-6 py-4 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {pagedContacts.map((contact) => (
                  <TableRow 
                    key={contact._id} 
                    className="group border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="px-6">
                       <Checkbox 
                        checked={selectedIds.includes(contact._id)} 
                        onCheckedChange={() => toggleSelect(contact._id)}
                        className="rounded-md"
                       />
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 rounded-xl border border-border/50 shadow-sm">
                          <AvatarImage src={contact.avatar || contact.avatarUrl} />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-black uppercase rounded-xl">
                            {contact.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                           <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">{contact.name}</span>
                           <span className="text-[11px] font-medium text-muted-foreground">{contact.phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/10 rounded-lg text-[9px] font-black uppercase tracking-widest">WABA</Badge>
                          <span className="text-[10px] font-bold text-muted-foreground opacity-60">Manual Import</span>
                       </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                          {contact.tags?.slice(0, 3).map((tag: any) => (
                            <Badge key={tag} className="bg-primary/5 text-primary border-none rounded-lg text-[9px] font-black px-2 h-5">
                              {tag}
                            </Badge>
                          ))}
                          {contact.tags && contact.tags.length > 3 && (
                            <span className="text-[9px] font-black text-muted-foreground opacity-40">+{contact.tags.length - 3}</span>
                          )}
                          {(!contact.tags || contact.tags.length === 0) && (
                            <span className="text-[10px] italic text-muted-foreground/50">-</span>
                          )}
                       </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground">
                            {format(parseISO(contact.createdAt), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground opacity-60">
                            {format(parseISO(contact.createdAt), 'hh:mm a')}
                          </span>
                       </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-all">
                               <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50">
                             <DropdownMenuItem 
                               className="rounded-xl font-bold h-10 cursor-pointer"
                               onClick={() => router.push(`/contacts/${contact._id}`)}
                             >
                               <Eye className="mr-2 h-4 w-4" /> View Profile
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               className="rounded-xl font-bold h-10 cursor-pointer"
                               onClick={() => handleEditContact(contact)}
                             >
                               <Edit2 className="mr-2 h-4 w-4" /> Edit Contact
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               className="rounded-xl font-bold h-10 cursor-pointer"
                               onClick={() => handleOpenSendTemplate(contact)}
                             >
                               <MessageSquare className="mr-2 h-4 w-4" /> Send Template
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                               className="rounded-xl font-bold h-10 text-destructive focus:bg-destructive/10 cursor-pointer"
                               onClick={() => handleRemoveContact(contact._id)}
                             >
                               <Trash2 className="mr-2 h-4 w-4" /> Remove
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
        
        {filteredContacts.length === 0 && (
           <div className="flex flex-col items-center justify-center py-24 text-center">
              <Users className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-bold text-foreground">No contacts found</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Try adjusting your search or filters to find what you&apos;re looking for.</p>
              <Button variant="outline" onClick={() => setSearch('')} className="rounded-xl font-bold">Clear Search</Button>
           </div>
        )}

        <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Showing {pagedContacts.length} of {filteredContacts.length} Contacts — Page {currentPage}/{totalPages}</p>
            <div className="flex items-center gap-2">
               <Button variant="ghost" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} size="sm" className="rounded-xl h-9 px-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Prev</Button>
               <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} size="sm" className="rounded-xl h-9 px-4 font-black uppercase text-[10px] tracking-widest bg-primary text-white border-none shadow-premium-sm">Next</Button>
            </div>
        </div>
            <CreateContactPanel 
              isOpen={isAddContactOpen} 
              onClose={() => {
                setIsAddContactOpen(false);
                setSelectedContact(null);
              }} 
              contact={selectedContact}
            />
            <DirectTemplateModal 
              isOpen={isSendTemplateOpen} 
              onClose={() => {
                setIsSendTemplateOpen(false);
                setSelectedContact(null);
              }} 
              contact={selectedContact}
            />
    </div>
    </div>
  );
}
