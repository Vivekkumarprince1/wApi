"use client";

import React from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Globe,
  CreditCard,
  Users,
  Calendar,
  Lock,
  ArrowRight,
  Loader2,
  Mail,
    Settings,
    Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import SuperAdminPageHeader from '@/components/super-admin/super-admin-page-header';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import axios from 'axios';

export default function FleetDirectoryPage() {
  const router = useRouter();
    const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'connected' | 'attention'>('all');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(null);
  
    const { data: workspaces = [], isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ['admin-workspaces'],
        queryFn: async () => {
                const response = await apiClient.get('/super-admin/workspaces');
            if (Array.isArray(response)) return response;
            if (Array.isArray(response?.data)) return response.data;
            return [];
        }
  });

  const handleLoginAs = async (workspaceId: string, wsName: string) => {
    const toastId = toast.loading(`Initiating bypass for ${wsName}...`);
    try {
      const res = await axios.post(`/api/super-admin/workspaces/${workspaceId}/impersonate`);
      if (res.data.success) {
        toast.success(`Access granted: ${wsName}`, { id: toastId });
        router.push(res.data.targetUrl);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Impersonation failed", { id: toastId });
    }
  };

    const deleteWorkspaceMutation = useMutation({
        mutationFn: async (input: { workspaceId: string; confirmName: string }) => {
            const response = await axios.delete(`/api/super-admin/workspaces/${input.workspaceId}?confirmName=${encodeURIComponent(input.confirmName)}`, {
                data: { confirmName: input.confirmName },
            });

            return response.data;
        },
        onSuccess: async (_data, variables) => {
            if (selectedWorkspaceId === variables.workspaceId) {
                setSelectedWorkspaceId(null);
            }
            await queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] });
            await refetch();
        },
    });

    const handleDeleteWorkspace = async (workspaceId: string, wsName: string) => {
        const confirmName = window.prompt(`Type ${wsName} to permanently delete this workspace and all related records.`);

        if (confirmName === null) {
            return;
        }

        if (confirmName.trim() !== wsName) {
            toast.error('Workspace name did not match');
            return;
        }

        const toastId = toast.loading(`Deleting ${wsName}...`);
        try {
            await deleteWorkspaceMutation.mutateAsync({ workspaceId, confirmName: confirmName.trim() });
            toast.success(`Deleted ${wsName}`, { id: toastId });
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || `Unable to delete ${wsName}`, { id: toastId });
        }
    };

    const workspaceRows = workspaces;

    const filteredWorkspaces = workspaceRows.filter((ws) => {
        const searchTarget = [
            ws.name,
            ws.owner?.name,
            ws.owner?.email,
            ws.gupshupAppId,
            ws.gupshupIdentity?.partnerAppId,
            ws.bspPhoneNumberId,
            ws.wabaId,
            ws._id,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        const matchesSearch = searchTarget.includes(search.toLowerCase());
        const isConnected = Boolean(ws.whatsappConnected) || Boolean(ws.gupshupAppLive) || Boolean(ws.gupshupAppHealth);
        const hasAttention = ['BANNED', 'DISCONNECTED', 'PENDING', 'INACTIVE'].includes(String(ws.bspPhoneStatus || '').toUpperCase()) || ws.gupshupAppHealth === false || ws.whatsappConnected === false;

        if (statusFilter === 'connected' && !isConnected) return false;
        if (statusFilter === 'attention' && !hasAttention) return false;

        return matchesSearch;
    });

    const selectedWorkspace = filteredWorkspaces.find((ws) => String(ws._id) === selectedWorkspaceId) || filteredWorkspaces[0] || null;

    const summaryCards = [
        {
            label: 'Total Workspaces',
            value: workspaceRows.length,
            description: 'Active workspace accounts',
            icon: Building2,
            tone: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
        },
        {
            label: 'Connected',
            value: workspaceRows.filter((ws) => ws.whatsappConnected).length,
            description: 'WhatsApp API connections',
            icon: Globe,
            tone: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
        },
        {
            label: 'Configured',
            value: workspaceRows.filter((ws) => ws.gupshupAppId || ws.gupshupIdentity?.partnerAppId).length,
            description: 'Gupshup app integrations',
            icon: Zap,
            tone: 'text-amber-600',
            bg: 'bg-amber-500/10',
        },
        {
            label: 'Needs Attention',
            value: workspaceRows.filter((ws) => ['BANNED', 'DISCONNECTED', 'PENDING', 'INACTIVE'].includes(String(ws.bspPhoneStatus || '').toUpperCase()) || ws.gupshupAppHealth === false || ws.whatsappConnected === false).length,
            description: 'Workspaces requiring action',
            icon: ShieldCheck,
            tone: 'text-rose-600',
            bg: 'bg-rose-500/10',
        },
    ];

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
            <div className="h-20 w-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="h-10 w-10 text-rose-500" />
            </div>
          <h2 className="text-2xl font-black uppercase text-rose-500">Access Denied</h2>
          <p className="text-muted-foreground font-medium mt-2">Fleet directory requires Level 4 Platform clearance.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20">
                <SuperAdminPageHeader
                    icon={Globe}
                    eyebrow="Workspace Intelligence"
                    title="Workspace Management"
                    subtitle={`Monitor and manage ${workspaceRows.length} workspaces, their configurations, and connection health.`}
                    actions={(
                        <>
                            <Button variant="outline" className="h-12 border-border/50 bg-background/50 backdrop-blur-sm px-6 rounded-2xl group transition-all hover:bg-muted" onClick={() => refetch()}>
                                <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin text-emerald-600' : 'text-muted-foreground group-hover:text-emerald-600'}`} />
                                <span className="text-xs font-black uppercase tracking-widest">Refresh Workspace Snapshot</span>
                            </Button>
                            <Button className="rounded-2xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-500/20 font-black uppercase tracking-widest text-xs text-white">
                                <Plus className="mr-2 h-4 w-4" /> Open Workspace
                            </Button>
                        </>
                    )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {summaryCards.map((card) => (
                        <Card key={card.label} className="border-none bg-background/50 backdrop-blur-3xl ring-1 ring-border/50 shadow-xl rounded-[32px] overflow-hidden">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <div className={`h-12 w-12 rounded-2xl ${card.bg} flex items-center justify-center ${card.tone}`}>
                                        <card.icon className="h-6 w-6" />
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest">Live</Badge>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{card.label}</p>
                                <div className="text-3xl font-black tracking-tighter tabular-nums mt-1">{card.value}</div>
                                <p className="text-xs font-medium text-muted-foreground mt-2">{card.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

        {/* Workspace Controls */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-background/50 backdrop-blur-3xl p-3 rounded-[32px] border border-border/40 shadow-xl">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
            <Input 
              placeholder="Filter by workspace name, owner email, app id, or workspace ID..." 
              className="pl-12 h-14 bg-transparent border-none focus-visible:ring-0 font-bold text-base placeholder:text-muted-foreground/40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
            <div className="flex flex-wrap items-center gap-2 pr-2 w-full md:w-auto">
              <Button variant={statusFilter === 'all' ? 'default' : 'ghost'} className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={() => setStatusFilter('all')}>
                  <Filter className="h-4 w-4 mr-2" /> All
              </Button>
              <Button variant={statusFilter === 'connected' ? 'default' : 'ghost'} className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-emerald-500/5 hover:text-emerald-600" onClick={() => setStatusFilter('connected')}>
                  <ShieldCheck className="h-4 w-4 mr-2" /> Connected
              </Button>
              <Button variant={statusFilter === 'attention' ? 'default' : 'ghost'} className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-emerald-500/5 hover:text-emerald-600" onClick={() => setStatusFilter('attention')}>
                  <Zap className="h-4 w-4 mr-2" /> Needs Attention
              </Button>
          </div>
        </div>

        {/* Workspace Table */}
        <Card className="border-none ring-1 ring-border/40 bg-background/40 backdrop-blur-3xl rounded-[48px] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-muted/30 border-b border-border/10">
                            <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Workspace</th>
                            <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Plan</th>
                            <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Integration</th>
                            <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Created</th>
                            <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} className="border-b border-border/5">
                                    <td className="p-8 py-10"><Skeleton className="h-12 w-64 rounded-2xl" /></td>
                                    <td className="p-8"><Skeleton className="h-8 w-24 rounded-full" /></td>
                                    <td className="p-8"><Skeleton className="h-8 w-32 rounded-lg" /></td>
                                    <td className="p-8"><Skeleton className="h-6 w-32" /></td>
                                    <td className="p-8 text-right"><Skeleton className="h-10 w-10 ml-auto rounded-xl" /></td>
                                </tr>
                            ))
                        ) : (
                            filteredWorkspaces.map((ws) => (
                                <tr
                                    key={ws._id}
                                    className={`border-b border-border/5 hover:bg-emerald-500/[0.02] transition-all group duration-300 cursor-pointer ${String(selectedWorkspace?._id) === String(ws._id) ? 'bg-emerald-500/[0.04]' : ''}`}
                                    onClick={() => setSelectedWorkspaceId(String(ws._id))}
                                >
                                    <td className="p-8 py-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-muted to-accent flex items-center justify-center font-black text-sm uppercase text-muted-foreground group-hover:from-emerald-500/20 group-hover:to-emerald-500/5 transition-all group-hover:scale-110 shadow-sm">
                                                {ws.name.slice(0, 2)}
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-lg text-foreground tracking-tight uppercase group-hover:text-emerald-600 transition-colors">
                                                        {ws.name}
                                                    </span>
                                                    {ws.isVerified && <ShieldCheck className="size-4 text-emerald-500" />}
                                                </div>
                                                <div className="flex items-center gap-3 font-semibold text-xs text-muted-foreground/60">
                                                    <span className="flex items-center gap-1"><Mail className="size-3" /> {ws.owner?.email || 'N/A'}</span>
                                                    <span className="h-1 w-1 bg-border rounded-full" />
                                                    <span className="tracking-widest text-[9px]">ID: {ws._id.toString().slice(-12).toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-8">
                                        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600 rounded-xl px-4 py-1.5 font-black text-[10px] tracking-[0.1em] uppercase shadow-sm">
                                            <CreditCard className="size-3 mr-2" /> {ws.plan?.name || 'Free Tier'}
                                        </Badge>
                                    </td>
                                    <td className="p-8">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2.5 w-2.5 rounded-full ${ws.whatsappConnected ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/80">
                                                {ws.whatsappConnected ? 'Active Connection' : 'Link Offline'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-8 font-black text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="size-3" />
                                            {ws.createdAt ? format(new Date(ws.createdAt), 'MMM dd, yyyy') : 'Pre-Engineered'}
                                        </div>
                                    </td>
                                    <td className="p-8 text-right">
                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-10 px-5 rounded-xl border-emerald-500/20 bg-background/50 hover:bg-emerald-600 text-emerald-600 hover:text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-sm"
                                                onClick={() => handleLoginAs(ws._id, ws.name)}
                                            >
                                                    Open Access
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-accent transition-all">
                                                        <MoreVertical className="h-5 w-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-none shadow-2xl bg-background/95 backdrop-blur-xl ring-1 ring-border/50">
                                                    <DropdownMenuItem className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 gap-3">
                                                        <Settings className="size-4 text-muted-foreground" /> Configure Node
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 gap-3">
                                                        <Users className="size-4 text-muted-foreground" /> Team Directory
                                                    </DropdownMenuItem>
                                                    <div className="h-px bg-border/50 my-1" />
                                                    <DropdownMenuItem
                                                        className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 gap-3 text-red-500 focus:bg-red-50 focus:text-red-600"
                                                        onSelect={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            handleDeleteWorkspace(ws._id, ws.name);
                                                        }}
                                                    >
                                                        <Trash2 className="size-4" /> Delete Workspace
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        {filteredWorkspaces.length === 0 && !isLoading && (
                            <tr>
                                <td colSpan={5} className="p-20 text-center">
                                    <Search className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                    <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No matching workspaces found in directory.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-8 bg-muted/20 border-t border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Workspace capacity: {workspaceRows.length} records</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest border-border/50 bg-background/50 hover:bg-muted transition-all">Previous Page</Button>
                    <Button variant="outline" size="sm" className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest border-border/50 bg-background/50 hover:bg-muted transition-all">Next Page</Button>
                </div>
            </div>
        </Card>

                <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8">
                    <Card className="border-none ring-1 ring-border/40 bg-background/40 backdrop-blur-3xl rounded-[40px] overflow-hidden shadow-2xl">
                        <CardHeader className="p-8 border-b border-border/10 bg-accent/5">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                        <Building2 className="h-5 w-5 text-emerald-600" /> Selected Workspace
                                    </CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-70">
                                        Workspace owner, plan, WABA, and sync snapshot.
                                    </CardDescription>
                                </div>
                                {selectedWorkspace && (
                                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-emerald-500/20 bg-emerald-500/5 text-emerald-600 py-1 px-3">
                                        {selectedWorkspace.billingStatus || 'unknown'}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            {selectedWorkspace ? (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Workspace</p>
                                            <div className="text-lg font-black uppercase tracking-tight">{selectedWorkspace.name}</div>
                                            <p className="text-xs text-muted-foreground">ID: {String(selectedWorkspace._id).slice(-12).toUpperCase()}</p>
                                        </div>
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Owner</p>
                                            <div className="text-lg font-black uppercase tracking-tight">{selectedWorkspace.owner?.name || 'Unassigned'}</div>
                                            <p className="text-xs text-muted-foreground">{selectedWorkspace.owner?.email || 'No owner email'}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Plan & Billing</p>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{selectedWorkspace.plan?.name || 'Free Tier'}</Badge>
                                                <Badge variant="secondary" className="uppercase tracking-widest text-[10px]">{selectedWorkspace.billingStatus || 'trialing'}</Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground">Plan slug: {selectedWorkspace.plan?.slug || 'not assigned'}</div>
                                        </div>
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Sync & Onboarding</p>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge className={selectedWorkspace.whatsappConnected ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}>
                                                    {selectedWorkspace.whatsappConnected ? 'WhatsApp Connected' : 'WhatsApp Offline'}
                                                </Badge>
                                                <Badge variant="secondary" className="uppercase tracking-widest text-[10px]">{selectedWorkspace.bspSyncStatus || 'INACTIVE'}</Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground">Onboarding: {selectedWorkspace.esbFlow?.status || 'not_started'}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">WABA & App</p>
                                            <div className="text-sm font-black break-all">Gupshup App: {selectedWorkspace.gupshupAppId || 'Pending'}</div>
                                            <div className="text-xs text-muted-foreground break-all">Partner App ID: {selectedWorkspace.gupshupIdentity?.partnerAppId || 'Pending'}</div>
                                            <div className="text-xs text-muted-foreground">WABA ID: {selectedWorkspace.wabaId || selectedWorkspace.bspWabaId || 'Pending'}</div>
                                        </div>
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Health Snapshot</p>
                                            <div className="text-sm font-black">Phone Status: {selectedWorkspace.bspPhoneStatus || 'PENDING'}</div>
                                            <div className="text-xs text-muted-foreground">App Health: {selectedWorkspace.gupshupAppHealth === null || selectedWorkspace.gupshupAppHealth === undefined ? 'Unknown' : selectedWorkspace.gupshupAppHealth ? 'Healthy' : 'Needs attention'}</div>
                                            <div className="text-xs text-muted-foreground">Last Sync: {selectedWorkspace.bspLastSyncedAt ? format(new Date(selectedWorkspace.bspLastSyncedAt), 'MMM dd, yyyy HH:mm') : 'Never'}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Wallet Balance</p>
                                            <div className="text-2xl font-black tabular-nums">{selectedWorkspace.wallet?.currency || selectedWorkspace.walletCurrency || 'INR'} {selectedWorkspace.wallet?.balance ?? selectedWorkspace.walletBalance ?? 0}</div>
                                        </div>
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Parked Balance</p>
                                            <div className="text-2xl font-black tabular-nums">{selectedWorkspace.wallet?.parkedBalance ?? selectedWorkspace.walletParkedBalance ?? 0}</div>
                                        </div>
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Threshold</p>
                                            <div className="text-2xl font-black tabular-nums">{selectedWorkspace.wallet?.thresholdAmount ?? selectedWorkspace.walletThreshold ?? 0}</div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <Button className="rounded-2xl h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px]" onClick={() => handleLoginAs(selectedWorkspace._id, selectedWorkspace.name)}>
                                            Bypass Access <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                        <Button variant="outline" className="rounded-2xl h-11 px-5 border-border/50 font-black uppercase tracking-widest text-[10px]" onClick={() => router.push('/super-admin/gupshup')}>
                                            Open BSP Provider
                                        </Button>
                                    </div>

                                    {Array.isArray(selectedWorkspace.phoneNumbers) && selectedWorkspace.phoneNumbers.length > 0 && (
                                        <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Phone Numbers</p>
                                            <div className="space-y-2">
                                                {selectedWorkspace.phoneNumbers.slice(0, 3).map((phone: any, index: number) => (
                                                    <div key={`${phone.id || index}`} className="flex items-center justify-between rounded-xl bg-background/60 px-4 py-3 border border-border/20">
                                                        <div>
                                                            <div className="text-sm font-black">{phone.displayPhoneNumber || 'Unknown number'}</div>
                                                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{phone.verifiedName || 'No verified name'}</div>
                                                        </div>
                                                        <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest">{phone.status || 'unknown'}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="min-h-[280px] flex items-center justify-center text-center rounded-3xl border border-dashed border-border/30 bg-muted/10 p-8">
                                    <div className="space-y-2 max-w-sm">
                                        <Building2 className="h-10 w-10 mx-auto text-muted-foreground/30" />
                                        <div className="text-lg font-black uppercase tracking-tight">No workspace selected</div>
                                        <p className="text-sm text-muted-foreground">Select a workspace from the directory to inspect its owner, app, wallet, and health snapshot.</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none ring-1 ring-border/40 bg-background/40 backdrop-blur-3xl rounded-[40px] overflow-hidden shadow-2xl">
                        <CardHeader className="p-8 border-b border-border/10 bg-accent/5">
                            <div className="space-y-1">
                                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                    <Users className="h-5 w-5 text-emerald-600" /> Operational Checklist
                                </CardTitle>
                                <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-70">
                                    What to review before touching the workspace.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                            {[
                                `Owner identity: ${selectedWorkspace?.owner?.email || 'unknown'}`,
                                `WABA connection: ${selectedWorkspace?.whatsappConnected ? 'connected' : 'offline'}`,
                                `Gupshup app: ${selectedWorkspace?.gupshupAppId || 'pending'}`,
                                `Phone status: ${selectedWorkspace?.bspPhoneStatus || 'PENDING'}`,
                                `Last sync: ${selectedWorkspace?.bspLastSyncedAt ? format(new Date(selectedWorkspace.bspLastSyncedAt), 'MMM dd, yyyy HH:mm') : 'never'}`,
                            ].map((item) => (
                                <div key={item} className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground/80">
                                    {item}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
      </div>
  );
}
