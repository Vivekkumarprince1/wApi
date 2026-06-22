"use client";

import React, { useCallback, useState } from 'react';
import { 
  Bell, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Inbox
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getPendingInvitations } from '@/lib/api/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function NotificationPanel() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(0);
  const router = useRouter();

  const fetchInvitations = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && lastFetchedAt && now - lastFetchedAt < 5 * 60 * 1000) {
      return;
    }

    setLoading(true);
    try {
      const response = (await getPendingInvitations()) as any;
      const data = response.success && response.invitations 
        ? response.invitations 
        : (response.data || response.invitations || []);
      setInvitations(data);
      setLastFetchedAt(now);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  }, [lastFetchedAt]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      fetchInvitations();
    }
  };

  const handleAccept = (token: string, email: string) => {
    router.push(`/auth/accept-invite?token=${token}&email=${encodeURIComponent(email)}`);
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group rounded-full h-10 w-10">
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:rotate-12 transition-all" />
          {invitations.length > 0 && (
            <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary border-2 border-background"></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 rounded-2xl shadow-premium border-border/50 p-0 overflow-hidden" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-4 py-3 bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notifications</span>
            {invitations.length > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full">
                {invitations.length} New
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="m-0 opacity-50" />
        
        <div className="max-h-[350px] overflow-y-auto">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary opacity-50" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Checking Alerts...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                <Inbox className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground/70">All caught up!</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">No new invitations or alerts</p>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {invitations.map((item, index) => {
                const id = item.id || item._id || `invite-${index}`;
                const workspaceName = item.workspaceName || (item.workspace as any)?.name || '';
                return (
                  <div 
                    key={id}
                    className="p-3 rounded-xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/50 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/5">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-foreground">
                            New Workspace Invitation
                          </p>
                          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                            You've been invited to join <span className="text-foreground font-bold">{workspaceName}</span> as a <span className="capitalize">{item.role}</span>.
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleAccept(item.token, item.email)}
                          className="w-full h-8 rounded-lg text-[10px] font-black uppercase tracking-widest"
                        >
                          Accept Invitation
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
