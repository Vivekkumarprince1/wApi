"use client";

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Plus, 
  Settings,
  Layers,
  ArrowRightLeft,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import api from '@/lib/api/client';
import { toast } from 'sonner';

interface Workspace {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  isDefault: boolean;
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const activeWorkspace = workspaces?.find(w => w?.isActive);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      // Axios interceptor returns response.data already unwrapped
      // API returns { success: true, data: [...] } → after interceptor, response = { success, data: [...] }
      const response = await api.get('/auth/workspaces') as any;
      setWorkspaces(response.data || []);
    } catch (error) {
      console.error("Failed to fetch workspaces", error);
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === activeWorkspace?.id?.toString()) return;
    
    setIsSwitching(true);
    try {
      await api.post('/auth/switch-workspace', { workspaceId });
      toast.success("Switched workspace successfully");
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to switch workspace");
      setIsSwitching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-14 w-full bg-muted/20 animate-pulse rounded-2xl border border-border/40" />
    );
  }

  // Single workspace — hide the switcher entirely
  if (workspaces.length <= 1) {
    return null;
  }

  // Multiple workspaces — full dropdown switcher
  return (
    <div className="relative w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full h-14 px-4 flex items-center justify-between rounded-2xl bg-card border border-border/40 hover:bg-muted/30 transition-all group overflow-hidden"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col items-start overflow-hidden text-left">
                <span className="text-xs font-black truncate w-[140px] block">{activeWorkspace?.name || 'Select Workspace'}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight opacity-60">
                  {activeWorkspace?.role || 'Member'}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            
            {isSwitching && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[280px] p-2 rounded-3xl border-border/50 shadow-2xl shadow-black/20 backdrop-blur-md">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 pt-2 pb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Switch Workspace</span>
            </DropdownMenuLabel>
            
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {workspaces?.map((ws) => (
                <DropdownMenuItem 
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  className={`
                    flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all
                    ${ws.isActive ? 'bg-primary/5 text-primary' : 'hover:bg-muted/50'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-xl flex items-center justify-center border
                      ${ws.isActive ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border/50'}
                    `}>
                      <Layers className={`h-4 w-4 ${ws.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black tracking-tight">{ws.name}</span>
                      <span className="text-[10px] uppercase font-black tracking-tighter opacity-50">{ws.role}</span>
                    </div>
                  </div>
                  {ws.isActive && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

