"use client";

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileCheck, AlertCircle, Loader2, CheckCircle2, FileUp, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactImportModal({ isOpen, onClose }: ContactImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewContacts, setPreviewContacts] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length === 0) {
        toast.error('The file is empty');
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
        return;
      }

      const contacts = lines.slice(1)
        .map(line => {
          const values = line.split(delimiter).map(v => v.trim().replace(/["']/g, ''));
          return {
            phone: values[phoneIndex],
            name: nameIndex !== -1 ? values[nameIndex] : 'Valued Customer',
            email: emailIndex !== -1 ? values[emailIndex] : ''
          };
        })
        .filter(c => c.phone && c.phone.length > 5);

      if (contacts.length === 0) {
        toast.error('No valid contacts found in the file');
        return;
      }

      setSelectedFile(file);
      setPreviewContacts(contacts);
      toast.success(`Successfully parsed ${contacts.length} contacts`);
    } catch (err: any) {
      toast.error('Failed to parse CSV file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading(true);
    try {
      const csvContent = await selectedFile.text();

      const response: any = await api.post('/bulk/contacts/csv-import/upload', {
        csvContent,
        fileName: selectedFile.name,
      });

      toast.success(response?.message || `Importing ${previewContacts.length} contacts in background`);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      
      handleReset();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to import contacts');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewContacts([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-[32px] border-none shadow-2xl overflow-hidden bg-background">
        <DialogHeader className="pt-4 px-2">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
               <Upload className="h-5 w-5" />
            </div>
            Import Contacts
          </DialogTitle>
          <DialogDescription className="font-medium text-muted-foreground">
            Bulk upload your audience using a CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!selectedFile ? (
            <div
              className="border-2 border-dashed border-border/50 rounded-3xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />

              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
                <FileUp className="h-8 w-8 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
              </div>
              <h3 className="font-black uppercase tracking-widest text-xs text-foreground mb-1">Choose CSV File</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Drag and drop or click to browse</p>
              
              <div className="mt-6 flex items-center justify-center gap-4">
                <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase bg-background">.CSV ONLY</Badge>
                <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase bg-background">MAX 10MB</Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                     <FileCheck className="h-5 w-5" />
                   </div>
                   <div>
                     <p className="font-bold text-sm text-foreground">{selectedFile.name}</p>
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">{previewContacts.length} Contacts Found</p>
                   </div>
                 </div>
                 <Button variant="ghost" size="icon" onClick={handleReset} className="rounded-xl hover:bg-destructive/10 hover:text-destructive">
                   <X className="h-4 w-4" />
                 </Button>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <ScrollArea className="h-[240px]">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3 h-auto">Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3 h-auto">Phone</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-3 h-auto">Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewContacts.map((contact, idx) => (
                        <TableRow key={idx} className="group border-border/20">
                          <TableCell className="text-xs font-bold py-3">{contact.name}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground py-3">{contact.phone}</TableCell>
                          <TableCell className="text-xs text-muted-foreground italic py-3">{contact.email || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Format Recommendation</p>
              <p className="text-[10px] font-bold text-muted-foreground leading-relaxed mt-1">
                Ensure your headers match <span className="text-primary">"name"</span>, <span className="text-primary">"phone"</span>, and <span className="text-primary">"email"</span>. 
                Other columns will be ignored.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-xl font-bold text-xs uppercase tracking-widest text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="rounded-2xl h-11 px-8 font-black shadow-lg shadow-primary/20 bg-primary min-w-[140px]"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Start Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
