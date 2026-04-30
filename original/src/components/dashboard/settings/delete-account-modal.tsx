"use client";

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Loader2, 
  Trash2, 
  X 
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/auth/account', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        // Short delay for the toast to be seen before redirect
        setTimeout(() => {
          router.push('/auth/login');
        }, 1500);
      } else {
        toast.error(result.message || 'Deletion failed');
        setIsDeleting(false);
      }
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('A network error occurred. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-[32px] p-8 border-destructive/20 gap-6">
        <DialogHeader className="space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mx-auto sm:mx-0">
             <AlertTriangle className="h-7 w-7" />
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight text-foreground sm:text-left text-center">
            Delete Account Forever?
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed sm:text-left text-center">
            This action is <span className="text-destructive font-bold uppercase underline">irreversible</span>. 
            Every workspace you own, along with all campaigns, templates, messages, and contact data will be purged. 
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
            Type <span className="text-foreground">DELETE</span> to confirm
          </label>
          <Input 
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="h-12 rounded-xl bg-muted/20 border-none font-black tracking-widest text-center focus-visible:ring-destructive/20"
            disabled={isDeleting}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            disabled={isDeleting}
            className="rounded-xl h-12 font-bold px-6 flex-1 border-none hover:bg-muted"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || isDeleting}
            className="rounded-xl h-12 font-black px-8 flex-1 shadow-lg shadow-destructive/20"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Purging Data...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
