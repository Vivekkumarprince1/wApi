"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  LayoutDashboard, 
  Inbox, 
  Users, 
  Megaphone, 
  Zap, 
  Settings, 
  Plus, 
  UserPlus, 
  MessageSquare,
  Moon,
  Sun,
  LayoutGrid,
  CreditCard,
  X
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  url?: string;
  action?: () => void;
  category: 'Pages' | 'Actions' | 'Settings';
}

import { useCommandStore } from '@/store/command-center-store';

export function CommandCenter() {
  const { isOpen, setOpen, toggle } = useCommandStore();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Overview of your workspace',
      icon: LayoutDashboard,
      url: '/',
      category: 'Pages'
    },
    {
      id: 'inbox',
      title: 'Inbox',
      description: 'Your messages and conversations',
      icon: Inbox,
      url: '/inbox',
      category: 'Pages'
    },
    {
      id: 'campaigns',
      title: 'Campaigns',
      description: 'Manage and send bulk messages',
      icon: Megaphone,
      url: '/campaign',
      category: 'Pages'
    },
    {
      id: 'crm',
      title: 'CRM / Pipeline',
      description: 'Manage customers and leads',
      icon: LayoutGrid,
      url: '/crm',
      category: 'Pages'
    },
    {
      id: 'automation',
      title: 'Automation',
      description: 'Workflows and auto-replies',
      icon: Zap,
      url: '/automation',
      category: 'Pages'
    },
    {
      id: 'new-campaign',
      title: 'Add New Campaign',
      description: 'Start a new marketing sequence',
      icon: Plus,
      url: '/campaign/create',
      category: 'Actions'
    },
    {
      id: 'invite-team',
      title: 'Invite Team Member',
      description: 'Add collaborators to workspace',
      icon: UserPlus,
      url: '/settings/team',
      category: 'Actions'
    },
    {
      id: 'billing',
      title: 'Manage Billing',
      description: 'View invoices and subscription',
      icon: CreditCard,
      url: '/billing',
      category: 'Settings'
    },
    {
      id: 'workspace-settings',
      title: 'Workspace Settings',
      description: 'General platform configuration',
      icon: Settings,
      url: '/settings',
      category: 'Settings'
    },
    {
      id: 'toggle-theme',
      title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      description: 'Change theme appearance',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      category: 'Actions'
    }
  ];

  const filteredCommands = query === '' 
    ? commands 
    : commands.filter((cmd) => 
        cmd.title.toLowerCase().includes(query.toLowerCase()) || 
        cmd.description?.toLowerCase().includes(query.toLowerCase())
      );

  const onSelect = (cmd: CommandItem) => {
    setOpen(false);
    setQuery('');
    if (cmd.url) {
      router.push(cmd.url);
    } else if (cmd.action) {
      cmd.action();
    }
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [toggle]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[activeIndex]) {
        onSelect(filteredCommands[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent 
        showCloseButton={false}
        className="max-w-2xl p-0 overflow-hidden bg-card/90 backdrop-blur-xl border-border/50 shadow-2xl"
      >
        <div className="flex items-center border-b border-border/50 px-4 py-3">
          <Search className="mr-3 h-5 w-5 text-muted-foreground animate-pulse" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1">
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-border py-4">
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground mt-1">Try searching for modules or actions like \"Campaign\" or \"Theme\"</p>
            </div>
          ) : (
            Object.entries(
              filteredCommands.reduce((acc, cmd) => {
                if (!acc[cmd.category]) acc[cmd.category] = [];
                acc[cmd.category].push(cmd);
                return acc;
              }, {} as Record<string, CommandItem[]>)
            ).map(([category, items], catIndex) => (
              <div key={category} className="mb-4 last:mb-0">
                <div className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {category}
                </div>
                {items.map((cmd) => {
                  // Calculate index in flat filtered list
                  const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                  const isSelected = activeIndex === globalIndex;

                  return (
                    <button
                      key={cmd.id}
                      onClick={() => onSelect(cmd)}
                      onMouseEnter={() => setActiveIndex(globalIndex)}
                      className={cn(
                        "flex w-full items-center gap-4 px-4 py-3 text-left transition-all border-l-2 border-transparent group",
                        isSelected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary"
                      )}>
                        <cmd.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-sm font-bold transition-colors",
                          isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
                        )}>
                          {cmd.title}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {cmd.description}
                        </div>
                      </div>
                      <div className={cn(
                        "text-[10px] font-medium text-muted-foreground transition-all translate-x-1",
                        isSelected ? "opacity-100 translate-x-0" : "opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                      )}>
                        Jump to
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/50 bg-muted/30 px-4 py-3 text-[10px] font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-background px-1 px-1">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-background px-1">⏎</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-background px-1">ESC</kbd>
              Close
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>ConnectSphere Spotlight</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
