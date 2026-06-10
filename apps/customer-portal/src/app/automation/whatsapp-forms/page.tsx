"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, Search, Filter, Eye, Edit3, Trash2, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FlashLoader from '@/components/ui/flash-loader';
import {
  deleteWhatsAppForm,
  fetchWhatsAppForms,
  publishWhatsAppForm,
  syncWhatsAppForm,
  unpublishWhatsAppForm,
  WhatsAppForm,
} from '@/lib/api/automation';

export default function WhatsAppFormsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'published'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-forms', activeTab, search],
    queryFn: () =>
      fetchWhatsAppForms({
        status: activeTab === 'all' ? undefined : activeTab,
        search: search || undefined,
      }),
  });

  const forms: WhatsAppForm[] = Array.isArray(data) ? data : [];

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishWhatsAppForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms'] });
      toast.success('Form published');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to publish form'),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => unpublishWhatsAppForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms'] });
      toast.success('Form unpublished');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to unpublish form'),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => syncWhatsAppForm(id),
    onSuccess: () => toast.success('Form synced'),
    onError: (error: any) => toast.error(error.message || 'Failed to sync form'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWhatsAppForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms'] });
      toast.success('Form deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete form'),
  });

  const stats = useMemo(() => {
    const total = forms.length;
    const active = forms.filter((f) => f.status === 'published').length;
    const responses = forms.reduce((sum, f) => sum + (f.statistics?.totalResponses || 0), 0);
    const completion = total
      ? Math.round(
          forms.reduce((sum, f) => sum + (f.statistics?.completionRate || 0), 0) / total
        )
      : 0;
    return { total, active, responses, completion };
  }, [forms]);

  if (isLoading) {
    return <FlashLoader />;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">WhatsApp Forms</h1>
          <p className="text-muted-foreground mt-1">Build and manage interactive forms for your WhatsApp audience.</p>
        </div>
        <Link href="/automation/whatsapp-forms/create">
          <Button className="rounded-full px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" /> Create New Form
          </Button>
        </Link>
      </div>

      {/* Stats / Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Responses', value: String(stats.responses), color: 'bg-blue-500' },
          { label: 'Completion Rate', value: `${stats.completion}%`, color: 'bg-green-500' },
          { label: 'Active Forms', value: String(stats.active), color: 'bg-purple-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-[32px] p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-foreground">{stat.value}</p>
            <div className={`h-1 w-12 ${stat.color} rounded-full mt-4`} />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search forms..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-transparent border-none focus-visible:ring-0"
          />
        </div>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setActiveTab('all')}>
          <Filter className="mr-2 h-4 w-4" /> Filter
        </Button>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={activeTab === 'all' ? 'default' : 'ghost'} className="rounded-xl" onClick={() => setActiveTab('all')}>All</Button>
          <Button size="sm" variant={activeTab === 'draft' ? 'default' : 'ghost'} className="rounded-xl" onClick={() => setActiveTab('draft')}>Draft</Button>
          <Button size="sm" variant={activeTab === 'published' ? 'default' : 'ghost'} className="rounded-xl" onClick={() => setActiveTab('published')}>Published</Button>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-[40px] p-12 flex flex-col items-center text-center space-y-4 shadow-sm">
          <div className="w-20 h-20 rounded-[28px] bg-primary/10 flex items-center justify-center text-primary mb-2">
            <ClipboardList className="h-10 w-10" />
          </div>
          <h3 className="text-2xl font-black tracking-tight text-foreground">No Forms Found</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Start capturing leads and gathering feedback with custom WhatsApp forms.
          </p>
          <Link href="/automation/whatsapp-forms/create">
            <Button variant="outline" className="rounded-full px-8 mt-4 border-primary/20 hover:bg-primary/5 text-primary font-bold">
              Create First Form
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border/50">
              <tr>
                <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Form</th>
                <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Responses</th>
                <th className="text-right p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form._id} className="border-b last:border-b-0 border-border/30">
                  <td className="p-4">
                    <p className="font-bold text-foreground">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.description || 'No description'}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Flow: {form.flowId || '-'}</span>
                      {form.category ? <span>• {form.category}</span> : null}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>{form.status}</Badge>
                  </td>
                  <td className="p-4 text-sm font-bold text-foreground">
                    <p>{form.statistics?.totalResponses || 0}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Last: {form.statistics?.lastResponseAt ? new Date(form.statistics.lastResponseAt).toLocaleDateString() : 'Never'}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => syncMutation.mutate(form._id)} title="Sync form" disabled={syncMutation.isPending}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Link href={`/automation/whatsapp-forms/${form._id}/responses`}>
                        <Button variant="ghost" size="icon" title="View responses">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/automation/whatsapp-forms/${form._id}/edit`}>
                        <Button variant="ghost" size="icon" disabled={form.status === 'published'} title="Edit form">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </Link>
                      {form.status === 'draft' ? (
                        <Button size="sm" onClick={() => publishMutation.mutate(form._id)} disabled={publishMutation.isPending}>Publish</Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => unpublishMutation.mutate(form._id)} disabled={unpublishMutation.isPending}>Unpublish</Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete form"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm('Delete this form and all its responses?')) {
                            deleteMutation.mutate(form._id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
