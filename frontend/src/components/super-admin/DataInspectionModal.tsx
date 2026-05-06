"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, 
  Save, 
  X, 
  AlertTriangle, 
  Code,
  ShieldAlert,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface DataInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: string;
  document: any;
  mode: 'view' | 'edit';
}

export default function DataInspectionModal({ 
  isOpen, 
  onClose, 
  collection, 
  document, 
  mode 
}: DataInspectionModalProps) {
  const queryClient = useQueryClient();
  const [jsonContent, setJsonContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (document) {
      setJsonContent(JSON.stringify(document, null, 2));
    }
  }, [document]);

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { _id, ...updateData } = payload;
      return apiClient.patch(`/super-admin/data/collections/${collection}/${_id}`, updateData);
    },
    onSuccess: () => {
      toast.success("Document updated successfully");
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update document");
    }
  });

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (parsed._id !== document._id) {
        return toast.error("Changing the _id is not permitted.");
      }
      updateMutation.mutate(parsed);
    } catch (e) {
      toast.error("Invalid JSON format");
      setHasError(true);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[85vh] p-0 overflow-hidden border-none shadow-2xl rounded-[40px] bg-background">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-8 border-b border-border/40 bg-muted/20">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-2xl",
                  mode === 'edit' ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                )}>
                  {mode === 'edit' ? <ShieldAlert className="h-6 w-6" /> : <Database className="h-6 w-6" />}
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    {mode === 'edit' ? 'Sensitive Modification' : 'Document Inspection'}
                    <Badge variant="outline" className="ml-2 font-mono text-[10px] bg-white">{collection}</Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground mt-1">
                    {mode === 'edit' 
                      ? 'Directly modifying records in the production cluster. Action will be logged.' 
                      : 'Viewing raw document architecture and metadata.'}
                  </DialogDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-xl h-10 w-10 hover:bg-muted"
                onClick={copyToClipboard}
              >
                {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 relative bg-slate-950">
            <ScrollArea className="h-full">
              <div className="p-0 h-full">
                {mode === 'edit' ? (
                  <textarea
                    className={cn(
                      "w-full h-full min-h-[50vh] p-8 bg-transparent text-emerald-400 font-mono text-[13px] leading-relaxed resize-none outline-none border-none",
                      hasError && "text-red-400"
                    )}
                    value={jsonContent}
                    onChange={(e) => {
                      setJsonContent(e.target.value);
                      setHasError(false);
                    }}
                    spellCheck={false}
                  />
                ) : (
                  <pre className="p-8 text-emerald-400 font-mono text-[13px] leading-relaxed">
                    {jsonContent}
                  </pre>
                )}
              </div>
            </ScrollArea>

            {mode === 'edit' && (
              <div className="absolute bottom-4 right-8 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 backdrop-blur-md">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Write Access Active</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-border/40 bg-muted/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">JSON v1.0 • UTF-8</span>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                onClick={onClose}
              >
                Cancel
              </Button>
              {mode === 'edit' && (
                <Button 
                  className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20 group"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                  )}
                  Commit Mutation
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
