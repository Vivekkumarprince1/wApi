"use client";

import { useMemo, useState } from 'react';
import {
  Copy,
  Layers,
  ListFilter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  createInteraktiveList,
  deleteInteraktiveList,
  fetchInteraktiveLists,
  InteraktiveList,
  toggleInteraktiveList,
  updateInteraktiveList,
} from '@/lib/api/automation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface DraftRow {
  id: string;
  title: string;
  description: string;
}

interface DraftState {
  _id?: string;
  name: string;
  description: string;
  keywordsCsv: string;
  header: string;
  body: string;
  footer: string;
  buttonText: string;
  sectionTitle: string;
  rows: DraftRow[];
}

const makeRowId = () => `row_${Math.random().toString(36).slice(2, 8)}`;

const emptyDraft = (): DraftState => ({
  name: '',
  description: '',
  keywordsCsv: '',
  header: '',
  body: '',
  footer: '',
  buttonText: 'Choose Option',
  sectionTitle: 'Menu',
  rows: [
    { id: makeRowId(), title: '', description: '' },
    { id: makeRowId(), title: '', description: '' },
  ],
});

const toDraftFromList = (list: InteraktiveList): DraftState => {
  const section = list.message.sections?.[0];
  return {
    _id: list._id,
    name: list.name || '',
    description: list.description || '',
    keywordsCsv: (list.triggerKeywords || []).join(', '),
    header: list.message.header || '',
    body: list.message.body || '',
    footer: list.message.footer || '',
    buttonText: list.message.buttonText || 'Choose Option',
    sectionTitle: section?.title || 'Menu',
    rows:
      section?.rows?.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description || '',
      })) || [{ id: makeRowId(), title: '', description: '' }],
  };
};

export default function InteraktiveListPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());

  const { data, isLoading } = useQuery({
    queryKey: ['interaktive-lists'],
    queryFn: () => fetchInteraktiveLists(),
  });

  const lists: InteraktiveList[] = data?.data || [];

  const filteredLists = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lists.filter((list) => {
      if (statusFilter === 'enabled' && !list.enabled) return false;
      if (statusFilter === 'disabled' && list.enabled) return false;

      if (!term) return true;
      return (
        list.name.toLowerCase().includes(term) ||
        (list.description || '').toLowerCase().includes(term) ||
        (list.triggerKeywords || []).some((keyword) => keyword.toLowerCase().includes(term))
      );
    });
  }, [lists, search, statusFilter]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => createInteraktiveList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interaktive-lists'] });
      toast.success('Interaktive list created');
      setShowForm(false);
      setDraft(emptyDraft());
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to create list'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateInteraktiveList(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interaktive-lists'] });
      toast.success('Interaktive list updated');
      setShowForm(false);
      setDraft(emptyDraft());
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update list'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleInteraktiveList(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interaktive-lists'] }),
    onError: (error: any) => toast.error(error?.message || 'Failed to toggle list'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInteraktiveList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interaktive-lists'] });
      toast.success('Interaktive list deleted');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to delete list'),
  });

  const submitDraft = () => {
    if (!draft.name.trim()) {
      toast.error('List name is required');
      return;
    }
    if (!draft.body.trim()) {
      toast.error('Message body is required');
      return;
    }

    const rows = draft.rows
      .map((row) => ({
        id: (row.id || makeRowId()).trim(),
        title: row.title.trim(),
        description: row.description.trim() || undefined,
      }))
      .filter((row) => row.id && row.title);

    if (rows.length === 0) {
      toast.error('Add at least one valid row');
      return;
    }

    const keywords = draft.keywordsCsv
      .split(',')
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      triggerKeywords: keywords,
      message: {
        header: draft.header.trim() || undefined,
        body: draft.body.trim(),
        footer: draft.footer.trim() || undefined,
        buttonText: draft.buttonText.trim() || 'Choose Option',
        sections: [
          {
            title: draft.sectionTitle.trim() || 'Menu',
            rows,
          },
        ],
      },
    };

    if (draft._id) {
      updateMutation.mutate({ id: draft._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreate = () => {
    setDraft(emptyDraft());
    setShowForm(true);
  };

  const openEdit = (list: InteraktiveList) => {
    setDraft(toDraftFromList(list));
    setShowForm(true);
  };

  const buildPayloadPreview = (list: InteraktiveList) => {
    return JSON.stringify(
      {
        type: 'interactive',
        interactive: {
          type: 'list',
          header: list.message.header ? { type: 'text', text: list.message.header } : undefined,
          body: { text: list.message.body },
          footer: list.message.footer ? { text: list.message.footer } : undefined,
          action: {
            button: list.message.buttonText,
            sections: list.message.sections,
          },
        },
      },
      null,
      2
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-background to-background p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-foreground">Interaktive List</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Build WhatsApp list menus with trigger keywords and reusable payloads for support and triage flows.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Lists</p>
              <p className="text-sm font-black">{lists.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</p>
              <p className="text-sm font-black">{lists.filter((list) => list.enabled).length}</p>
            </div>
            <Button className="rounded-xl font-bold" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create List
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-5">
          <div className="space-y-2">
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 border-none">Smart Triage</Badge>
            <h2 className="text-xl font-black text-foreground">Tap-First Customer Routing</h2>
            <p className="text-sm text-muted-foreground">
              Use interactive list menus for quick category selection before AnswerBot, workflows, or human handoff.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-background border border-border/50 flex items-center justify-center text-emerald-600">
              <Zap className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">Works best with 3-8 clear options and distinct keyword triggers.</p>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-3xl p-5">
          <div className="space-y-2">
            <h3 className="text-lg font-black text-foreground">Flow Readiness</h3>
            <p className="text-sm text-muted-foreground">Enable a list only when message body, button text, and rows are fully configured.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">Header Optional</Badge>
            <Badge variant="secondary" className="rounded-full">Body Required</Badge>
            <Badge variant="secondary" className="rounded-full">At Least 1 Row</Badge>
            <Badge variant="secondary" className="rounded-full">Keywords Optional</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-2xl border border-border/50">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search interactive lists..."
            className="pl-10 bg-transparent border-none focus-visible:ring-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>All</Button>
          <Button size="sm" variant={statusFilter === 'enabled' ? 'default' : 'outline'} onClick={() => setStatusFilter('enabled')}>Enabled</Button>
          <Button size="sm" variant={statusFilter === 'disabled' ? 'default' : 'outline'} onClick={() => setStatusFilter('disabled')}>Disabled</Button>
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ListFilter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="overflow-hidden bg-card border border-border/50 rounded-3xl">
          <div className="p-12 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 rounded-[28px] bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2">
              <Layers className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">No Interactive Lists</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Create your first interactive list to guide customers through menu-driven choices on WhatsApp.
            </p>
            <Button variant="outline" className="rounded-xl font-bold" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create First List
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredLists.map((list) => (
            <div key={list._id} className="rounded-3xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-foreground">{list.name}</h3>
                  {list.description ? <p className="text-sm text-muted-foreground mt-0.5">{list.description}</p> : null}
                </div>
                <Badge variant={list.enabled ? 'default' : 'secondary'}>{list.enabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>

              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <p className="text-sm font-semibold">{list.message.body}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(list.message.sections?.[0]?.rows || []).slice(0, 5).map((row) => (
                    <Badge key={row.id} variant="outline" className="rounded-full text-[11px]">
                      {row.title}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(list.triggerKeywords || []).map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="rounded-full">{keyword}</Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(list)}>Edit</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleMutation.mutate({ id: list._id, enabled: !list.enabled })}
                  disabled={toggleMutation.isPending}
                >
                  {list.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(buildPayloadPreview(list));
                    toast.success('Interactive payload copied');
                  }}
                >
                  <Copy className="h-4 w-4 mr-1.5" /> Copy Payload
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate(list._id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[1px]">
          <div className="absolute inset-x-0 bottom-0 top-8 md:top-12 mx-auto max-w-3xl rounded-t-3xl md:rounded-3xl border border-border/60 bg-background p-5 md:p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="text-xl font-black tracking-tight">{draft._id ? 'Edit Interaktive List' : 'Create Interaktive List'}</h3>
                <p className="text-sm text-muted-foreground">Configure message content, options, and keyword triggers.</p>
              </div>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Close</Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">List Name</label>
                  <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Support Main Menu" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Keywords (comma separated)</label>
                  <Input value={draft.keywordsCsv} onChange={(e) => setDraft((prev) => ({ ...prev, keywordsCsv: e.target.value }))} placeholder="menu, help, options" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Description</label>
                <Input value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="Primary routing menu for inbound support chats" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Header (optional)</label>
                  <Input value={draft.header} onChange={(e) => setDraft((prev) => ({ ...prev, header: e.target.value }))} placeholder="Welcome to Support" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Button Text</label>
                  <Input value={draft.buttonText} onChange={(e) => setDraft((prev) => ({ ...prev, buttonText: e.target.value }))} placeholder="Choose Option" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Body Message</label>
                <Textarea value={draft.body} onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))} className="min-h-[90px]" placeholder="Hi, pick one option so I can help you quickly." />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Footer (optional)</label>
                <Input value={draft.footer} onChange={(e) => setDraft((prev) => ({ ...prev, footer: e.target.value }))} placeholder="Response time: under 2 minutes" />
              </div>

              <div className="rounded-2xl border border-border/60 p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Section Title</label>
                    <Input value={draft.sectionTitle} onChange={(e) => setDraft((prev) => ({ ...prev, sectionTitle: e.target.value }))} placeholder="Menu" />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          rows: [...prev.rows, { id: makeRowId(), title: '', description: '' }],
                        }))
                      }
                    >
                      <Plus className="h-4 w-4 mr-1.5" /> Add Row
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {draft.rows.map((row, idx) => (
                    <div key={row.id} className="rounded-xl border border-border/50 p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-xs font-semibold">Row ID</label>
                        <Input
                          value={row.id}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              rows: prev.rows.map((r, i) => (i === idx ? { ...r, id: e.target.value } : r)),
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-xs font-semibold">Title</label>
                        <Input
                          value={row.title}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              rows: prev.rows.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r)),
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-xs font-semibold">Description</label>
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              rows: prev.rows.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)),
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          disabled={draft.rows.length <= 1}
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              rows: prev.rows.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Save this list, then use Copy Payload for manual send integrations.
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button
                    onClick={submitDraft}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    {draft._id ? 'Save Changes' : 'Create List'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
