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
  AlertTriangle,
  Globe,
  Phone,
  CornerDownLeft,
  Settings,
  KeyRound,
  Tag,
  MessageSquare,
  Send,
  Pencil
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
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 22 } }
};

const getCategoryBadge = (category: string) => {
  const cat = (category || '').toUpperCase();
  let icon = <Tag className="h-3 w-3" />;
  let color = 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';

  if (cat === 'AUTHENTICATION') {
    icon = <KeyRound className="h-3 w-3" />;
    color = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  } else if (cat === 'UTILITY') {
    icon = <Settings className="h-3 w-3" />;
    color = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  }

  return (
    <Badge variant="outline" className={`text-[9px] font-black h-5 uppercase tracking-wider flex items-center gap-1 bg-card/50 ${color}`}>
      {icon}
      {cat}
    </Badge>
  );
};

const renderQualityScore = (quality?: any) => {
  const q = String(quality?.score || quality || 'UNKNOWN').toUpperCase();
  let color = 'bg-slate-400';
  let label = 'Unknown Quality';
  let pillColor = 'bg-slate-500/10 text-slate-600 border-slate-500/20';
  
  if (q === 'HIGH' || q === 'GREEN') {
    color = 'bg-emerald-500';
    label = 'High Quality';
    pillColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  } else if (q === 'MEDIUM' || q === 'YELLOW') {
    color = 'bg-amber-500';
    label = 'Medium Quality';
    pillColor = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  } else if (q === 'LOW' || q === 'RED') {
    color = 'bg-rose-500';
    label = 'Low Quality';
    pillColor = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  }

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${pillColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`} />
      {label}
    </div>
  );
};

const formatBodyTextWithPills = (text: string = '') => {
  if (!text) return '';
  const parts = text.split(/(\{\{\d+\}\})/g);
  return parts.map((part, index) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return (
        <span 
          key={index} 
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold border border-primary/20 text-[10px] mx-0.5"
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

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
    onSuccess: (data: any) => {
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
	               aria-label="Show templates as grid"
	             >
	               <LayoutGrid className="h-5 w-5" />
	             </Button>
             <Button 
               variant="ghost" 
	               size="icon" 
	               className={`h-11 w-11 rounded-xl ${viewMode === 'list' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
	               onClick={() => setViewMode('list')}
	               aria-label="Show templates as list"
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
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filteredTemplates.map((template) => (
                <div key={template._id} className="relative h-[360px] w-full group">
                  <motion.div 
                    variants={itemVariants}
                    className="absolute top-0 left-0 w-full h-full group-hover:h-auto group-hover:min-h-[360px] transition-all duration-300 z-10 group-hover:z-30 bg-card border border-border/50 rounded-3xl shadow-sm group-hover:shadow-xl flex flex-col overflow-hidden"
                  >
                    {/* Card Info Header */}
                    <div className="p-5 pb-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                         {getStatusBadge(template.status)}
                          <div className="flex items-center gap-1.5">
                             {/* APPROVED */}
                             {template.status === 'APPROVED' && (
                               <>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 shadow-sm transition-all"
                                   onClick={() => { setSelectedTemplate(template); setIsUseModalOpen(true); }}
                                   title="Create Campaign"
                                   aria-label={`Create campaign from ${template.name}`}
                                 >
                                   <Send className="h-3.5 w-3.5" />
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10 shadow-sm transition-all"
                                   onClick={() => { if(confirm('Are you sure you want to archive this template?')) deleteMutation.mutate(template._id) }}
                                   title="Archive Template"
                                   aria-label={`Archive ${template.name}`}
                                 >
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </Button>
                               </>
                             )}

                             {/* DRAFT */}
                             {template.status === 'DRAFT' && (
                               <>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 shadow-sm transition-all"
                                   onClick={() => submitMutation.mutate(template._id)}
                                   disabled={submitMutation.isPending}
                                   title="Submit to Meta"
                                   aria-label={`Submit ${template.name} to Meta`}
                                 >
                                   <Zap className="h-3.5 w-3.5" />
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-muted text-muted-foreground border-border hover:bg-muted/50 shadow-sm transition-all"
                                   onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}
                                   title="Edit Template"
                                   aria-label={`Edit ${template.name}`}
                                 >
                                   <Pencil className="h-3.5 w-3.5" />
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10 shadow-sm transition-all"
                                   onClick={() => { if(confirm('Are you sure you want to archive this template?')) deleteMutation.mutate(template._id) }}
                                   title="Archive Template"
                                   aria-label={`Archive ${template.name}`}
                                 >
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </Button>
                               </>
                             )}

                             {/* REJECTED / FAILED */}
                             {(template.status === 'REJECTED' || template.status === 'FAILED') && (
                               <>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 shadow-sm transition-all"
                                   onClick={() => submitMutation.mutate(template._id)}
                                   disabled={submitMutation.isPending}
                                   title="Resubmit to Meta"
                                   aria-label={`Resubmit ${template.name} to Meta`}
                                 >
                                   <Zap className="h-3.5 w-3.5" />
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-muted text-muted-foreground border-border hover:bg-muted/50 shadow-sm transition-all"
                                   onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}
                                   title="Edit Template"
                                   aria-label={`Edit ${template.name}`}
                                 >
                                   <Pencil className="h-3.5 w-3.5" />
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="icon" 
                                   className="h-8 w-8 rounded-full bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10 shadow-sm transition-all"
                                   onClick={() => { if(confirm('Are you sure you want to archive this template?')) deleteMutation.mutate(template._id) }}
                                   title="Archive Template"
                                   aria-label={`Archive ${template.name}`}
                                 >
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </Button>
                               </>
                             )}

                             {/* DELETED */}
                             {template.status === 'DELETED' && (
                               <Button 
                                 variant="outline" 
                                 size="icon" 
                                 className="h-8 w-8 rounded-full bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 shadow-sm transition-all"
                                 onClick={() => updateStatusMutation.mutate({ id: template._id, status: 'DRAFT' })}
                                 title="Restore Template"
                                 aria-label={`Restore ${template.name}`}
                               >
                                 <RefreshCcw className="h-3.5 w-3.5" />
                               </Button>
                             )}

                             {/* PENDING / IN_APPEAL */}
                             {(template.status === 'PENDING' || template.status === 'IN_APPEAL') && (
                               <div className="h-8 w-8 rounded-full flex items-center justify-center bg-amber-500/5 text-amber-600 border border-amber-500/20" title="Locked (In Review)">
                                 <Clock className="h-4 w-4" />
                               </div>
                             )}
                          </div>
                      </div>

                      <div className="space-y-1.5">
                        <h3 
                          className="font-bold text-[14px] text-foreground line-clamp-1 group-hover:text-primary transition-colors cursor-pointer"
                          onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}
                          title={template.name}
                        >
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {getCategoryBadge(template.category)}
                          <Badge variant="outline" className="text-[9px] font-black h-5 uppercase tracking-wider flex items-center gap-1 bg-card/50 opacity-70 border-border/50">
                            <Globe className="h-3 w-3" />
                            {template.language || 'en'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Simulated WhatsApp Interface Centerpiece */}
                    <div className="px-5 pb-5 flex-1 flex flex-col justify-between">
                      <div className="bg-[#efeae2] dark:bg-zinc-900/40 p-3.5 rounded-2xl relative border border-border/40 select-none flex-1 flex flex-col justify-between overflow-hidden shadow-inner h-[180px] group-hover:h-auto transition-all duration-300 relative">
                        {/* WhatsApp wallpaper texture */}
                        <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat bg-center" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }} />
                        
                        {/* Bottom fade overlay when card is collapsed */}
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#efeae2] dark:from-zinc-900 to-transparent pointer-events-none z-20 group-hover:opacity-0 transition-opacity duration-300" />

                        {/* WhatsApp Bubble Container */}
                        <div className="bg-background dark:bg-zinc-950 rounded-xl rounded-tl-none shadow-sm border border-border/10 p-3 relative flex-1 flex flex-col justify-between z-10">
                          {/* Bubble Tail */}
                          <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-background dark:bg-zinc-950 border-l border-t border-border/10 -rotate-45" />
                          
                          <div>
                            {/* Header Attachment Rendering */}
                            {template.header?.enabled && (
                              <div className="mb-2">
                                {template.header.format === 'TEXT' && template.header.text && (
                                  <div className="text-xs font-bold text-foreground mb-1">{template.header.text}</div>
                                )}
                                {template.header.format === 'IMAGE' && (
                                  <div className="aspect-[16/9] w-full rounded-lg bg-muted dark:bg-zinc-900 flex flex-col items-center justify-center border border-border/30 mb-2 text-muted-foreground/60">
                                    <ImageIcon className="h-5 w-5 mb-0.5 text-muted-foreground/40" />
                                    <span className="text-[8px] font-black uppercase tracking-wider">Image Header</span>
                                  </div>
                                )}
                                {template.header.format === 'VIDEO' && (
                                  <div className="aspect-[16/9] w-full rounded-lg bg-muted dark:bg-zinc-900 flex flex-col items-center justify-center border border-border/30 mb-2 text-muted-foreground/60 relative">
                                    <Video className="h-5 w-5 mb-0.5 text-muted-foreground/40" />
                                    <span className="text-[8px] font-black uppercase tracking-wider">Video Header</span>
                                  </div>
                                )}
                                {template.header.format === 'DOCUMENT' && (
                                  <div className="py-2 px-3 rounded-lg bg-muted dark:bg-zinc-900 flex items-center gap-2 border border-border/30 mb-2 text-muted-foreground/70">
                                    <FileIcon className="h-4 w-4 text-primary/70 flex-shrink-0" />
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <span className="text-[9px] font-bold truncate">document.pdf</span>
                                      <span className="text-[7px] opacity-75 font-semibold">PDF Attachment</span>
                                    </div>
                                  </div>
                                )}
                                {(template.header.format as string) === 'LOCATION' && (
                                  <div className="aspect-[16/9] w-full rounded-lg bg-muted dark:bg-zinc-900 flex flex-col items-center justify-center border border-border/30 mb-2 text-muted-foreground/60">
                                    <MapPin className="h-5 w-5 mb-0.5 text-muted-foreground/40" />
                                    <span className="text-[8px] font-black uppercase tracking-wider">Location Header</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Body Text */}
                            <div className="text-[11px] font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                              {formatBodyTextWithPills(template.bodyText || template.body?.text)}
                            </div>

                            {/* Footer Text */}
                            {template.bodyText && template.bodyText.includes('\n\n') && (
                              <div className="text-[9px] text-muted-foreground mt-2 font-medium">
                                {template.name}
                              </div>
                            )}
                          </div>

                          {/* WhatsApp Style Buttons */}
                          {template.buttons && template.buttons.items.length > 0 && (
                            <div className="border-t border-border/10 mt-3 pt-1 divide-y divide-border/10">
                              {template.buttons.items.map((btn, i) => (
                                <div 
                                  key={i} 
                                  className="py-2 text-[10px] font-bold text-primary hover:bg-primary/5 cursor-pointer flex items-center justify-center gap-1.5 select-none transition-colors border-border/10"
                                >
                                  {btn.type === 'URL' && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
                                  {btn.type === 'PHONE_NUMBER' && <Phone className="h-3 w-3 flex-shrink-0" />}
                                  {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="h-3 w-3 flex-shrink-0" />}
                                  {btn.text}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Metadata Footer */}
                    <div className="px-5 py-3 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                       <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Created {new Date(template.createdAt).toLocaleDateString()}</span>
                       {renderQualityScore(template.qualityScore)}
                    </div>
                  </motion.div>
                </div>
              ))}
            </motion.div>
          ) : (
            <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
               <table className="w-full text-left whitespace-nowrap">
                 <thead>
                   <tr className="bg-muted/30 border-b border-border/40">
                     <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Template Name</th>
                     <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Status</th>
                     <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Category</th>
                     <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Quality</th>
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
                        <td className="px-6 py-5">{getCategoryBadge(template.category)}</td>
                        <td className="px-6 py-5">{renderQualityScore(template.qualityScore)}</td>
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center gap-1 text-xs font-black uppercase text-muted-foreground">
                            <Globe className="h-3.5 w-3.5" />
                            {template.language}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                           <div className="flex items-center justify-end gap-1.5">
                             {/* APPROVED */}
                             {template.status === 'APPROVED' && (
                               <>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Create campaign from ${template.name}`} 
                                   className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600" 
                                   onClick={() => { setSelectedTemplate(template); setIsUseModalOpen(true); }}
                                 >
                                   <Send className="h-4 w-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Archive ${template.name}`} 
                                   className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" 
                                   onClick={() => { if(confirm('Are you sure you want to archive this template?')) deleteMutation.mutate(template._id) }}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </>
                             )}

                             {/* DRAFT */}
                             {template.status === 'DRAFT' && (
                               <>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Submit ${template.name} for approval`} 
                                   className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" 
                                   onClick={() => submitMutation.mutate(template._id)}
                                   disabled={submitMutation.isPending}
                                 >
                                   <Zap className="h-4 w-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Edit ${template.name}`} 
                                   className="h-8 w-8 rounded-lg hover:bg-muted-foreground/10" 
                                   onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}
                                 >
                                   <Pencil className="h-4 w-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Archive ${template.name}`} 
                                   className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" 
                                   onClick={() => { if(confirm('Are you sure you want to archive this template?')) deleteMutation.mutate(template._id) }}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </>
                             )}

                             {/* REJECTED / FAILED */}
                             {(template.status === 'REJECTED' || template.status === 'FAILED') && (
                               <>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Resubmit ${template.name}`} 
                                   className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" 
                                   onClick={() => submitMutation.mutate(template._id)}
                                   disabled={submitMutation.isPending}
                                 >
                                   <Zap className="h-4 w-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Edit ${template.name}`} 
                                   className="h-8 w-8 rounded-lg hover:bg-muted-foreground/10" 
                                   onClick={() => { setSelectedTemplate(template); setIsEditModalOpen(true); }}
                                 >
                                   <Pencil className="h-4 w-4" />
                                 </Button>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   aria-label={`Archive ${template.name}`} 
                                   className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" 
                                   onClick={() => { if(confirm('Are you sure you want to archive this template?')) deleteMutation.mutate(template._id) }}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </>
                             )}

                             {/* DELETED */}
                             {template.status === 'DELETED' && (
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 aria-label={`Restore ${template.name}`} 
                                 className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600" 
                                 onClick={() => updateStatusMutation.mutate({ id: template._id, status: 'DRAFT' })}
                               >
                                 <RefreshCcw className="h-4 w-4" />
                               </Button>
                             )}

                             {/* PENDING / IN_APPEAL */}
                             {(template.status === 'PENDING' || template.status === 'IN_APPEAL') && (
                               <div className="h-8 w-8 rounded-lg flex items-center justify-center text-amber-600 bg-amber-500/5 border border-amber-500/10" title="Locked (In Review)">
                                 <Clock className="h-4 w-4" />
                               </div>
                             )}
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
              <Button variant="link" className="p-0 h-auto font-black text-primary text-xs uppercase tracking-widest hover:translate-x-1 transition-transform" onClick={() => router.push('/templates/rules')}>
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
              <Button variant="link" className="p-0 h-auto font-black text-emerald-600 text-xs uppercase tracking-widest hover:translate-x-1 transition-transform" onClick={() => router.push('/templates/analytics')}>
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
