"use client";

import React from 'react';
import { 
  Megaphone, 
  Search, 
  Filter, 
  MoreVertical, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Calendar,
  Lock,
  ArrowRight,
  Loader2,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layout
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function MetaTemplatesDirectoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  const { data: templates = [], isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const response = await apiClient.get('/super-admin/templates');
      if (Array.isArray(response)) return response;
      if (Array.isArray(response?.data)) return response.data;
      return [];
    }
  });

  const filteredTemplates = templates.filter((template) => {
    const searchTarget = [
      template.name,
      template.workspace?.name,
      template.category,
      template.language,
      template.metaTemplateId,
      template._id
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch = searchTarget.includes(search.toLowerCase());
    
    if (statusFilter === 'approved' && template.status !== 'APPROVED') return false;
    if (statusFilter === 'pending' && template.status !== 'PENDING') return false;
    if (statusFilter === 'rejected' && template.status !== 'REJECTED') return false;

    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest">Approved</Badge>;
      case 'PENDING':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest animate-pulse">Pending</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest">Rejected</Badge>;
      case 'DRAFT':
        return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest">Draft</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest">{status}</Badge>;
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="h-20 w-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-10 w-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black uppercase text-rose-500">Access Denied</h2>
        <p className="text-muted-foreground font-medium mt-2">Template directory requires Level 4 Platform clearance.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10 pb-20 font-inter">
      <SuperAdminPageHeader
        icon={Megaphone}
        eyebrow="Content Intelligence"
        title="Meta Templates"
        subtitle={`Audit and manage ${templates.length} WhatsApp message templates across all platform nodes.`}
        actions={(
          <Button variant="outline" className="h-12 border-border/50 bg-background/50 backdrop-blur-sm px-6 rounded-2xl group transition-all hover:bg-muted" onClick={() => refetch()}>
            <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
            <span className="text-xs font-black uppercase tracking-widest">Sync Registry</span>
          </Button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="border-none bg-background/50 backdrop-blur-3xl ring-1 ring-border/50 shadow-xl rounded-[32px] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Layout className="h-6 w-6" />
              </div>
              <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest">Total</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Templates</p>
            <div className="text-3xl font-black tracking-tighter tabular-nums mt-1">{templates.length}</div>
          </CardContent>
        </Card>

        <Card className="border-none bg-background/50 backdrop-blur-3xl ring-1 ring-border/50 shadow-xl rounded-[32px] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Live</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Approved</p>
            <div className="text-3xl font-black tracking-tighter tabular-nums mt-1 text-emerald-600">{templates.filter(t => t.status === 'APPROVED').length}</div>
          </CardContent>
        </Card>

        <Card className="border-none bg-background/50 backdrop-blur-3xl ring-1 ring-border/50 shadow-xl rounded-[32px] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
              <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-amber-600">Syncing</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Pending Review</p>
            <div className="text-3xl font-black tracking-tighter tabular-nums mt-1 text-amber-600">{templates.filter(t => t.status === 'PENDING').length}</div>
          </CardContent>
        </Card>

        <Card className="border-none bg-background/50 backdrop-blur-3xl ring-1 ring-border/50 shadow-xl rounded-[32px] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest text-rose-600">Attention</Badge>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Rejected</p>
            <div className="text-3xl font-black tracking-tighter tabular-nums mt-1 text-rose-600">{templates.filter(t => t.status === 'REJECTED').length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-background/50 backdrop-blur-3xl p-3 rounded-[32px] border border-border/40 shadow-xl">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search by name, category, language, or workspace..." 
            className="pl-12 h-14 bg-transparent border-none focus-visible:ring-0 font-bold text-base placeholder:text-muted-foreground/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pr-2 w-full md:w-auto">
          <Button variant={statusFilter === 'all' ? 'default' : 'ghost'} className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={() => setStatusFilter('all')}>
            <Filter className="h-4 w-4 mr-2" /> All
          </Button>
          <Button variant={statusFilter === 'approved' ? 'default' : 'ghost'} className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-emerald-500/5 hover:text-emerald-600" onClick={() => setStatusFilter('approved')}>
            <ShieldCheck className="h-4 w-4 mr-2" /> Approved
          </Button>
          <Button variant={statusFilter === 'pending' ? 'default' : 'ghost'} className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-amber-500/5 hover:text-amber-600" onClick={() => setStatusFilter('pending')}>
            <Clock className="h-4 w-4 mr-2" /> Pending
          </Button>
          <Button variant={statusFilter === 'rejected' ? 'default' : 'ghost'} className="h-12 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-rose-500/5 hover:text-rose-600" onClick={() => setStatusFilter('rejected')}>
            <AlertCircle className="h-4 w-4 mr-2" /> Rejected
          </Button>
        </div>
      </div>

      <Card className="border-none ring-1 ring-border/40 bg-background/40 backdrop-blur-3xl rounded-[48px] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/10">
                <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Template Name</th>
                <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Category</th>
                <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Workspace</th>
                <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Status</th>
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
                filteredTemplates.map((template) => (
                  <tr key={template._id} className="border-b border-border/5 hover:bg-primary/[0.02] transition-all group duration-300">
                    <td className="p-8 py-10">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-muted to-accent flex items-center justify-center font-black text-sm uppercase text-muted-foreground group-hover:from-primary/20 group-hover:to-primary/5 transition-all group-hover:scale-110 shadow-sm">
                          {template.language?.slice(0, 2).toUpperCase() || 'EN'}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-lg text-foreground tracking-tight uppercase group-hover:text-primary transition-colors">
                              {template.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-semibold text-xs text-muted-foreground/60">
                            <span className="flex items-center gap-1"><Calendar className="size-3" /> {format(new Date(template.createdAt), 'MMM dd, yyyy')}</span>
                            <span className="h-1 w-1 bg-border rounded-full" />
                            <span className="tracking-widest text-[9px]">ID: {template.metaTemplateId || 'LOCAL_ONLY'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-8">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 rounded-xl px-4 py-1.5 font-black text-[10px] tracking-[0.1em] uppercase shadow-sm">
                        {template.category}
                      </Badge>
                    </td>
                    <td className="p-8">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground/80">{template.workspace?.name || 'Unknown'}</span>
                        <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">{template.workspace?.gupshupAppId || 'No App ID'}</span>
                      </div>
                    </td>
                    <td className="p-8">
                      {getStatusBadge(template.status)}
                    </td>
                    <td className="p-8 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                        <Button variant="outline" size="sm" className="h-10 px-5 rounded-xl border-primary/20 bg-background/50 hover:bg-primary text-primary hover:text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-sm">
                          Preview
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-accent transition-all">
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-none shadow-2xl bg-background/95 backdrop-blur-xl ring-1 ring-border/50">
                            <DropdownMenuItem className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 gap-3">
                              <ExternalLink className="size-4 text-muted-foreground" /> View in Meta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl font-black uppercase tracking-widest text-[10px] py-3 gap-3">
                              <Building2 className="size-4 text-muted-foreground" /> Go to Workspace
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {filteredTemplates.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <Search className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No matching templates found in global registry.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
