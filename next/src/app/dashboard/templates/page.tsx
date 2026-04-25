"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  RefreshCcw, 
  LayoutGrid, 
  List, 
  BarChart4, 
  Zap,
  MoreVertical,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  AlertCircle,
  TrendingUp,
  Image as ImageIcon,
  Video,
  FileText as FileIcon,
  MapPin,
  ExternalLink,
  Trash2,
  Filter,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { 
  fetchTemplates, 
  fetchTemplateCategories, 
  syncTemplates, 
  deleteTemplate,
  Template 
} from '@/lib/api/templates';
import { useAuthStore } from '@/store/auth-store';
import FlashLoader from '@/components/ui/flash-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Modals
import CreateTemplateModal from '@/components/modals/create-template-modal';

import UseTemplateModal from '@/components/modals/use-template-modal';
import DirectTemplateModal from '@/components/dashboard/contacts/DirectTemplateModal';

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [isDirectSendOpen, setIsDirectSendOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => fetchTemplates()
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['templateCategories'],
    queryFn: () => fetchTemplateCategories()
  });

  const templates: Template[] = templatesData?.data || [];
  const categories: string[] = categoriesData?.categories || [];

  const syncMutation = useMutation({
    mutationFn: () => syncTemplates(),
    onSuccess: (data) => {
      toast.success(data.message || 'Sync successful');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => toast.error(err.message || 'Sync failed')
  });


  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => toast.error(err.message || 'Delete failed')
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => import('@/lib/api/templates').then(m => m.submitTemplateToMeta(id)),
    onSuccess: () => {
      toast.success('Template submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => toast.error(err.message || 'Submission failed')
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => import('@/lib/api/templates').then(m => m.updateTemplate(id, { status })),
    onSuccess: (_, variables) => {
      toast.success(`Template moved to ${variables.status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => toast.error(err.message || 'Status update failed')
  });

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (!t) return false;
      // Tab filter
      const status = (t.status || 'draft').toLowerCase();
      if (activeTab === 'all') return status !== 'deleted'; // Standard 'All' view hides deleted, but keeps them in DB for history
      if (activeTab === 'active' && status !== 'approved') return false;
      if (activeTab === 'pending' && !['pending', 'in_appeal'].includes(status)) return false;
      if (activeTab === 'rejected' && !['rejected', 'failed'].includes(status)) return false;
      if (activeTab === 'drafts' && status !== 'draft') return false;
      if (activeTab === 'deleted' && status !== 'deleted') return false;

      // Category filter
      if (category !== 'ALL' && t.category !== category) return false;

      // Search filter
      if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;

      return true;
    });
  }, [templates, activeTab, category, search]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'APPROVED':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full font-black uppercase text-[9px] tracking-widest"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'PENDING':
      case 'IN_APPEAL':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full font-black uppercase text-[9px] tracking-widest"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'REJECTED':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 rounded-full font-black uppercase text-[9px] tracking-widest"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 rounded-full font-black uppercase text-[9px] tracking-widest ring-1 ring-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" /> Failed Sync</Badge>;
      case 'DRAFT':
        return <Badge className="bg-muted text-muted-foreground border-border rounded-full font-black uppercase text-[9px] tracking-widest"><FileText className="h-3 w-3 mr-1" /> Draft</Badge>;
      case 'DELETED':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20 rounded-full font-black uppercase text-[9px] tracking-widest line-through grayscale"><Trash2 className="h-3 w-3 mr-1" /> Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getHeaderIcon = (format: string) => {
    switch (format) {
      case 'IMAGE': return <ImageIcon className="h-4 w-4" />;
      case 'VIDEO': return <Video className="h-4 w-4" />;
      case 'DOCUMENT': return <FileIcon className="h-4 w-4" />;
      case 'LOCATION': return <MapPin className="h-4 w-4" />;
      default: return null;
    }
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Templates
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-emerald-500/5 text-emerald-600 border-emerald-500/10">
              {templates.length} Total
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Create and manage your WhatsApp message templates.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="rounded-2xl px-6 h-12 border-border/50 hover:bg-muted font-bold transition-all"
          >
            {syncMutation.isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Sync from Meta</span>
          </Button>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-2xl px-6 h-12 shadow-premium hover:shadow-primary/20 transition-all font-bold bg-primary group"
          >
            <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Active', count: templates.filter(t => t.status === 'APPROVED').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
          { label: 'Pending', count: templates.filter(t => ['PENDING', 'IN_APPEAL'].includes(t.status)).length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/5' },
          { label: 'High Quality', count: templates.filter(t => t.qualityScore?.score === 'HIGH').length, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/5' },
          { label: 'Rejected', count: templates.filter(t => ['REJECTED', 'FAILED'].includes(t.status)).length, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/5' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border/50 rounded-3xl p-5 flex items-center gap-4 group hover:shadow-premium-sm transition-all">
            <div className={`h-12 w-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-black text-foreground">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-1.5 flex flex-1 items-center gap-2 overflow-x-auto custom-scrollbar shadow-sm">
          <div className="flex bg-muted/30 p-1 rounded-2xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'pending', label: 'Pending' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'drafts', label: 'Drafts' },
              { id: 'deleted', label: 'Deleted' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-background text-primary shadow-sm ring-1 ring-border/50' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="relative flex-1 min-w-[200px] border-l border-border/50 pl-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search templates..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 h-10 bg-transparent border-none focus-visible:ring-0 shadow-none font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px] h-13 rounded-2xl bg-card border-border/50 font-bold focus:ring-primary/20">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl p-2 shadow-premium">
              <SelectItem value="ALL" className="rounded-xl font-bold">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c} className="rounded-xl font-bold">{c.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="bg-muted/30 p-1 rounded-2xl flex border border-border/40">
             <Button 
               variant="ghost" 
               size="icon" 
               className={`h-11 w-11 rounded-xl ${viewMode === 'grid' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
               onClick={() => setViewMode('grid')}
             >
               <LayoutGrid className="h-5 w-5" />
             </Button>
             <Button 
               variant="ghost" 
               size="icon" 
               className={`h-11 w-11 rounded-xl ${viewMode === 'list' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
               onClick={() => setViewMode('list')}
             >
               <List className="h-5 w-5" />
             </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + viewMode}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4 }}
          className="min-h-[400px]"
        >
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500 bg-card border border-border/50 rounded-3xl">
              <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 shadow-premium-sm border border-primary/10">
                <FileText className="h-10 w-10 text-primary opacity-40" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No templates found</h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto font-medium">Create a new template to start your next campaign.</p>
              <Button 
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-xl px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-bold group"
              >
                <Plus className="h-5 w-5 mr-2" /> Create First Template
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTemplates.map((template) => (
                <div 
                  key={template._id} 
                  className="group bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm hover:shadow-premium transition-all flex flex-col h-full relative"
                >
                  <div className="p-5 flex-1 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                       {getStatusBadge(template.status)}
                       <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                           {/* PRIMARY ACTIONS: Only Draft/Approved (REJECTED/FAILED moved to menu to avoid confusion) */}
                          {template.status === 'APPROVED' && (
                            <Button 
                             variant="outline" 
                             size="icon" 
                             className="h-8 w-8 rounded-full bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 shadow-premium-sm"
                             onClick={() => { setSelectedTemplate(template); setIsUseModalOpen(true); }}
                             title="Create Campaign"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                          {template.status === 'DRAFT' && (
                            <Button 
                             variant="outline" 
                             size="icon" 
                             className="h-8 w-8 rounded-full bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 shadow-premium-sm"
                             onClick={() => submitMutation.mutate(template._id)}
                             disabled={submitMutation.isPending}
                             title="Submit for Approval"
                            >
                              <Zap className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Dropdown Menu for all other actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shadow-none"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-2 shadow-premium border-border/50">
                              {/* Submit: Only for Drafts/Rejected/Failed */}
                              {(template.status === 'DRAFT' || template.status === 'REJECTED' || template.status === 'FAILED') && (
                                <DropdownMenuItem className="rounded-xl h-10 font-bold cursor-pointer text-primary" onClick={() => submitMutation.mutate(template._id)}>
                                  <Zap className="h-4 w-4 mr-2" /> Submit to Meta
                                </DropdownMenuItem>
                              )}
                              
                              {/* Edit: Only if NOT Pending/Deleted/Approved */}
                              {!['PENDING', 'DELETED', 'APPROVED'].includes(template.status) && (
                                <DropdownMenuItem className="rounded-xl h-10 font-bold cursor-pointer" onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}>
                                  Edit Template
                                </DropdownMenuItem>
                              )}

                              {/* Restore: From DELETED to DRAFT */}
                              {template.status === 'DELETED' && (
                                <DropdownMenuItem className="rounded-xl h-10 font-bold text-emerald-600 bg-emerald-500/5 cursor-pointer" onClick={() => updateStatusMutation.mutate({ id: template._id, status: 'DRAFT' })}>
                                  <RefreshCcw className="h-4 w-4 mr-2" /> Move to Draft
                                </DropdownMenuItem>
                              )}

                              {/* Delete: Only if NOT Pending/Deleted */}
                              {!['PENDING', 'DELETED'].includes(template.status) && (
                                <DropdownMenuItem className="rounded-xl h-10 font-bold text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={() => { if(confirm('Are you sure you want to archive this template?')) deleteMutation.mutate(template._id) }}>
                                  Archive
                                </DropdownMenuItem>
                              )}

                              {/* Info for Pending */}
                              {template.status === 'PENDING' && (
                                <DropdownMenuItem disabled className="rounded-xl h-10 font-bold text-muted-foreground opacity-60">
                                  Template Locked (In Review)
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                       </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-black text-[15px] text-foreground line-clamp-1 group-hover:text-primary transition-colors cursor-pointer" onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}>
                        {template.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[8px] font-black h-4 uppercase tracking-tighter opacity-70 border-border/50">{template.category}</Badge>
                        <Badge variant="outline" className="text-[8px] font-black h-4 uppercase tracking-tighter opacity-70 border-border/50">EN</Badge>
                      </div>
                    </div>

                    <div className="bg-muted/30 dark:bg-muted/10 p-4 rounded-2xl text-[12px] font-medium leading-relaxed text-muted-foreground h-32 overflow-hidden relative shadow-inner">
                       <div className="line-clamp-5 whitespace-pre-wrap">{template.bodyText || template.body?.text}</div>
                       <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card/80 to-transparent" />
                    </div>

                    {template.buttons && template.buttons.items.length > 0 && (
                      <div className="space-y-2">
                        {template.buttons.items.slice(0, 2).map((btn, i) => (
                          <div key={i} className="py-2.5 px-4 bg-muted/40 border border-border/50 rounded-xl text-[11px] font-bold text-center text-primary/80 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="px-5 py-3 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Created {new Date(template.createdAt).toLocaleDateString()}</span>
                     <div className="flex items-center gap-3">
                       {template.header?.enabled && <div className="text-muted-foreground">{getHeaderIcon(template.header.format)}</div>}
                       {template.status === 'APPROVED' && <TrendingUp className="h-4 w-4 text-emerald-500 opacity-60" />}
                     </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/40">
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Template Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Language</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredTemplates.map((template) => (
                    <tr key={template._id} className="group hover:bg-muted/20 transition-colors">
                       <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all">
                               {template.header?.enabled ? getHeaderIcon(template.header.format) : <FileText className="h-5 w-5" />}
                             </div>
                             <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground group-hover:text-primary flex items-center gap-2 cursor-pointer" onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}>
                                  {template.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[300px]">{template.bodyText || template.body?.text}</span>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-5">{getStatusBadge(template.status)}</td>
                       <td className="px-6 py-5"><Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter opacity-70">{template.category}</Badge></td>
                       <td className="px-6 py-5"><span className="text-xs font-black uppercase text-muted-foreground">{template.language}</span></td>
                       <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {template.status === 'APPROVED' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600" onClick={() => { setSelectedTemplate(template); setIsUseModalOpen(true); }}>
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                            )}
                            {template.status === 'DRAFT' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" 
                                onClick={() => submitMutation.mutate(template._id)}
                                title="Submit for Approval"
                              >
                                <Zap className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Dropdown Menu for Table Mode */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 shadow-premium border-border/50">
                                {!['PENDING', 'DELETED', 'APPROVED'].includes(template.status) && (
                                  <DropdownMenuItem className="rounded-xl h-10 font-bold cursor-pointer" onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}>Edit</DropdownMenuItem>
                                )}
                                {template.status === 'DELETED' && (
                                  <DropdownMenuItem className="rounded-xl h-10 font-bold text-emerald-600 bg-emerald-500/5 cursor-pointer" onClick={() => updateStatusMutation.mutate({ id: template._id, status: 'DRAFT' })}>Restore</DropdownMenuItem>
                                )}
                                {!['PENDING', 'DELETED'].includes(template.status) && (
                                  <DropdownMenuItem className="rounded-xl h-10 font-bold text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={() => { if(confirm('Archive?')) deleteMutation.mutate(template._id) }}>Archive</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="group bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 p-8 rounded-[40px] flex flex-col md:flex-row items-center gap-8 shadow-premium-sm">
           <div className="h-20 w-20 rounded-[30px] bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-500">
              <Zap className="h-10 w-10 fill-white" />
           </div>
           <div className="flex-1 text-center md:text-left space-y-2">
              <h3 className="text-xl font-black text-foreground">Template Rules</h3>
              <p className="text-sm text-muted-foreground font-medium">Create automated triggers based on template activity and quality scores.</p>
              <Button variant="link" className="p-0 h-auto font-black text-primary text-xs uppercase tracking-widest hover:translate-x-1 transition-transform" onClick={() => router.push('/dashboard/templates/rules')}>
                Manage Rules <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
           </div>
        </div>
        
        <div className="group bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/10 p-8 rounded-[40px] flex flex-col md:flex-row items-center gap-8 shadow-premium-sm">
           <div className="h-20 w-20 rounded-[30px] bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-500">
              <TrendingUp className="h-10 w-10" />
           </div>
           <div className="flex-1 text-center md:text-left space-y-2">
              <h3 className="text-xl font-black text-foreground">Advanced Analytics</h3>
              <p className="text-sm text-muted-foreground font-medium">Deep dive into template performance, delivery metrics, and ROI tracking.</p>
              <Button variant="link" className="p-0 h-auto font-black text-emerald-600 text-xs uppercase tracking-widest hover:translate-x-1 transition-transform" onClick={() => router.push('/dashboard/templates/analytics')}>
                View Insights <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
           </div>
        </div>
      </div>

      <CreateTemplateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {selectedTemplate && (
        <>
          <CreateTemplateModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} template={selectedTemplate} />
          <UseTemplateModal 
            isOpen={isUseModalOpen} 
            onClose={() => setIsUseModalOpen(false)} 
            template={selectedTemplate} 
            onDirectSend={(id) => {
              setIsUseModalOpen(false);
              setIsDirectSendOpen(true);
            }}
          />
          <DirectTemplateModal 
            isOpen={isDirectSendOpen} 
            onClose={() => setIsDirectSendOpen(false)} 
            initialTemplateId={selectedTemplate._id}
          />
        </>
      )}
    </div>
  );
}
