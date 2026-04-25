'use client';

import React, { useState } from 'react';
import { X, Plus, Search, Store, Smartphone, Code, Globe, MessageSquare, Mail, User, Loader2, CheckCircle2, FileUp, AlertCircle, FileCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createContact, updateContact, importContacts } from '@/lib/api/contacts';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

interface CreateContactPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: any; // Add contact prop for edit mode
}

const CreateContactPanel = ({ isOpen, onClose, contact }: CreateContactPanelProps) => {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<'manual' | 'automated'>('manual');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewContacts, setPreviewContacts] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync state when contact is provided (Edit Mode)
  React.useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        phone: contact.phone || '',
        email: contact.email || contact.metadata?.email || '',
      });
      setMethod('manual');
    } else {
      setFormData({ name: '', phone: '', email: '' });
    }
  }, [contact, isOpen]);

  const { mutate: handleSave, isPending } = useMutation({
    mutationFn: (data: any) => contact ? updateContact(contact._id, data) : createContact(data),
    onSuccess: () => {
      toast.success(contact ? 'Contact updated successfully' : 'Contact created successfully');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (!contact) setFormData({ name: '', phone: '', email: '' });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || `Failed to ${contact ? 'update' : 'create'} contact`);
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const { mutate: handleBulkImport, isPending: isImporting } = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return importContacts(formData);
    },
    onSuccess: (response: any) => {
      toast.success(response.data?.message || `Successfully imported ${previewContacts.length} contacts`);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      handleReset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to import contacts');
    }
  });

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewContacts([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      // Tiny delay to ensure UI renders the loading state
      await new Promise(resolve => setTimeout(resolve, 50));

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

      // Faster parsing for large files
      const contacts: any[] = [];
      for (let i = 1; i < lines.length; i++) {
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
        toast.error('No valid contacts found in the file');
        setIsParsing(false);
        return;
      }

      setSelectedFile(file);
      setPreviewContacts(contacts);
      toast.success(`Successfully parsed ${contacts.length} contacts`);
    } catch (err) {
      toast.error('Failed to parse CSV file');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error('Name and Phone are required');
      return;
    }
    handleSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="ml-auto relative w-full max-w-md bg-card shadow-premium overflow-y-auto border-l border-border animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-foreground">Create Contacts</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-foreground mb-4">Choose a Method</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  checked={method === 'manual'}
                  onChange={() => setMethod('manual')}
                  className="w-4 h-4 text-primary focus:ring-0"
                />
                <span className={`text-sm font-medium ${method === 'manual' ? 'text-primary' : 'text-muted-foreground'}`}>Manual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  checked={method === 'automated'}
                  onChange={() => setMethod('automated')}
                  className="w-4 h-4 text-primary focus:ring-0"
                />
                <span className={`text-sm font-medium ${method === 'automated' ? 'text-primary' : 'text-muted-foreground'}`}>Automated</span>
              </label>
            </div>
          </div>

          {method === 'automated' ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search Integrations..."
                  className="w-full pl-10 pr-4 py-2 bg-muted rounded-xl border-none text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-3">
                {[
                  { title: 'Shopify', icon: Store, color: 'text-emerald-500', desc: 'Auto-sync orders & checkouts.' },
                  { title: 'Mobile App', icon: Smartphone, color: 'text-blue-500', desc: 'Sync your phone contacts.' },
                  { title: 'API', icon: Code, color: 'text-indigo-500', desc: 'Programmable contact management.' },
                  { title: 'Google Sheets', icon: Globe, color: 'text-emerald-600', desc: 'Sync rows automatically.' },
                ].map((item) => (
                  <div key={item.title} className="p-4 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer group">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-foreground mb-1">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {!selectedFile ? (
                <div 
                  className={`
                    border-2 border-dashed border-border rounded-3xl p-8 text-center transition-all cursor-pointer group
                    ${isParsing ? 'bg-primary/5 border-primary/30 cursor-wait' : 'bg-muted/30 hover:bg-primary/5 hover:border-primary/50'}
                  `}
                  onClick={() => !isParsing && fileInputRef.current?.click()}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isParsing}
                  />
                  {isParsing ? (
                    <div className="flex flex-col items-center animate-in fade-in duration-300">
                      <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Scanning File...</p>
                    </div>
                  ) : (
                    <>
                      <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-3 group-hover:scale-110 transition-transform group-hover:text-primary opacity-50" />
                      <p className="text-sm font-bold text-foreground mb-1 uppercase tracking-widest text-[10px]">Bulk Import CSV</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Click to select or drag and drop</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{selectedFile.name}</p>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">{previewContacts.length} Contacts</p>
                      </div>
                    </div>
                    <button onClick={handleReset} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                    <ScrollArea className="h-48">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent border-border/40">
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 h-auto">Name</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 h-auto">Phone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewContacts.slice(0, 100).map((contact, idx) => (
                            <TableRow key={idx} className="group border-border/10">
                              <TableCell className="text-[11px] font-bold py-2">{contact.name}</TableCell>
                              <TableCell className="text-[11px] font-mono text-muted-foreground py-2">{contact.phone}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {previewContacts.length > 100 && (
                      <div className="p-2 bg-muted/30 text-center text-[9px] font-bold text-muted-foreground border-t border-border/10">
                        + {previewContacts.length - 100} more contacts
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => handleBulkImport(selectedFile)}
                    disabled={isImporting}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isImporting ? 'Importing...' : 'Confirm Bulk Import'}
                  </button>
                </div>
              )}

              {!selectedFile && (
                <>
                  <div className="relative py-4 flex items-center justify-center">
                    <span className="absolute px-3 bg-card text-[10px] font-black text-muted-foreground tracking-widest uppercase">OR MANUAL ENTRY</span>
                    <div className="w-full h-px bg-border/50" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input 
                          name="name" 
                          required 
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="John Doe" 
                          className="w-full pl-9 pr-4 py-3 bg-muted/50 rounded-xl border border-border/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Phone *</label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input 
                          name="phone" 
                          required 
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+91 9876543210" 
                          className="w-full pl-9 pr-4 py-3 bg-muted/50 rounded-xl border border-border/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input 
                          name="email" 
                          type="email" 
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="john@example.com" 
                          className="w-full pl-9 pr-4 py-3 bg-muted/50 rounded-xl border border-border/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isPending}
                      className="w-full py-3.5 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 mt-4 flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {contact ? 'Updating...' : 'Creating...'}
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          {contact ? 'Update Contact' : 'Save Contact'}
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateContactPanel;

