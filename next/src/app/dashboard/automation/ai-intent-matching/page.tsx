"use client";

import React, { useState } from 'react';
import { Brain, Plus, Search, Sparkles, Target, Zap, Trash2, ToggleLeft, ToggleRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface IntentRule {
  _id: string;
  name: string;
  enabled: boolean;
  trigger: { config: { intentLabel: string; trainingPhrases: string[] } };
  actions: Array<{ type: string; config: any }>;
  stats?: { count: number; lastMatch: string | null };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
const fetchIntents = () => axios.get('/api/automation/ai-intent').then(r => r.data.data);
const createIntent = (data: any) => axios.post('/api/automation/ai-intent', data).then(r => r.data);
const toggleIntent = (id: string, enabled: boolean) =>
  axios.patch(`/api/automation/engine/rules/${id}/toggle`, { enabled }).then(r => r.data);
const deleteIntent = (id: string) => axios.delete(`/api/automation/engine/rules/${id}`).then(r => r.data);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AIIntentMatchingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    intentLabel: '',
    phraseInput: '',
    phrases: [] as string[],
    replyMessage: ''
  });

  // ── Queries & Mutations ─────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['ai-intents'],
    queryFn: fetchIntents
  });

  const rules: IntentRule[] = data?.rules || [];

  const createMutation = useMutation({
    mutationFn: createIntent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-intents'] });
      toast.success('Intent trained and active');
      setShowCreate(false);
      setForm({ name: '', intentLabel: '', phraseInput: '', phrases: [], replyMessage: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create intent')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleIntent(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-intents'] })
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIntent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-intents'] });
      toast.success('Intent removed');
    }
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addPhrase = () => {
    const phrase = form.phraseInput.trim();
    if (!phrase || form.phrases.includes(phrase)) return;
    setForm(f => ({ ...f, phrases: [...f.phrases, phrase], phraseInput: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      intentLabel: form.intentLabel.toUpperCase().replace(/\s+/g, '_'),
      trainingPhrases: form.phrases,
      actions: form.replyMessage ? [{
        type: 'send_message',
        config: { messageType: 'text', body: form.replyMessage }
      }] : []
    });
  };

  const filtered = rules.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.trigger.config?.intentLabel?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Brain className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">AI Intent Match</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-purple-500" />
              {rules.length} intents trained · recognizes customer intent in any phrasing
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="rounded-full px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-lg shadow-purple-500/20 text-white font-bold border-none"
        >
          <Plus className="mr-2 h-4 w-4" /> Create New Intent
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search intents by name or label..."
            className="pl-10 bg-transparent border-none focus-visible:ring-0 font-medium"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Intent List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-[40px] p-12 flex flex-col items-center text-center space-y-4 shadow-sm">
          <div className="w-20 h-20 rounded-[28px] bg-purple-500/10 flex items-center justify-center text-purple-600 mb-2">
            <Brain className="h-10 w-10" />
          </div>
          <h3 className="text-2xl font-black tracking-tight text-foreground">No Intents Trained</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Start by defining what your customers might ask — type variations you've seen in real conversations.
          </p>
          <Button onClick={() => setShowCreate(true)} className="rounded-full px-8 mt-2 bg-purple-600 text-white font-bold">
            Train First Intent
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rule => (
            <motion.div
              key={rule._id}
              layout
              className="bg-card border border-border/50 rounded-[28px] overflow-hidden hover:border-purple-500/30 transition-all"
            >
              <div
                className="p-5 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === rule._id ? null : rule._id)}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${rule.enabled ? 'bg-purple-500/10 text-purple-600' : 'bg-muted text-muted-foreground'}`}>
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground">{rule.name}</p>
                  <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">{rule.trigger.config?.intentLabel}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {rule.stats?.count || 0} matches
                  </Badge>
                  <Badge className={`text-[10px] font-bold ${rule.enabled ? 'bg-emerald-500/10 text-emerald-600 border-none' : 'bg-muted text-muted-foreground border-none'}`}>
                    {rule.enabled ? 'Active' : 'Paused'}
                  </Badge>
                  {expandedId === rule._id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              <AnimatePresence>
                {expandedId === rule._id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5 border-t border-border/30 bg-muted/20"
                  >
                    <div className="pt-4 space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Training Phrases</p>
                        <div className="flex flex-wrap gap-2">
                          {rule.trigger.config?.trainingPhrases?.map((p: string, i: number) => (
                            <span key={i} className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full font-medium">
                              "{p}"
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl font-bold gap-2"
                          onClick={() => toggleMutation.mutate({ id: rule._id, enabled: !rule.enabled })}
                          disabled={toggleMutation.isPending}
                        >
                          {rule.enabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4 text-emerald-500" />}
                          {rule.enabled ? 'Pause' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl font-bold text-destructive hover:bg-destructive/10 gap-2"
                          onClick={() => deleteMutation.mutate(rule._id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Intent Modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border shadow-2xl z-[101] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black">Train New Intent</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)} className="rounded-xl">
                    <Plus className="rotate-45 h-5 w-5" />
                  </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Intent Name</label>
                    <Input required placeholder="e.g. Pricing Query" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11 rounded-xl bg-muted/30 border-none" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Intent Label (used by engine)</label>
                    <Input required placeholder="PRICING_QUERY" value={form.intentLabel} onChange={e => setForm(f => ({ ...f, intentLabel: e.target.value }))} className="h-11 rounded-xl bg-muted/30 border-none font-mono" />
                    <p className="text-[10px] text-muted-foreground italic">Will be auto-formatted to UPPER_SNAKE_CASE</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Training Phrases ({form.phrases.length}/min 2)</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a phrase and press Enter"
                        value={form.phraseInput}
                        onChange={e => setForm(f => ({ ...f, phraseInput: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhrase(); } }}
                        className="h-11 rounded-xl bg-muted/30 border-none flex-1"
                      />
                      <Button type="button" onClick={addPhrase} className="h-11 px-4 rounded-xl"><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                      {form.phrases.map((p, i) => (
                        <span key={i} className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                          "{p}"
                          <button type="button" onClick={() => setForm(f => ({ ...f, phrases: f.phrases.filter((_, j) => j !== i) }))} className="text-purple-400 hover:text-destructive ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Auto-Reply Message (optional)</label>
                    <textarea
                      placeholder="When this intent matches, send..."
                      value={form.replyMessage}
                      onChange={e => setForm(f => ({ ...f, replyMessage: e.target.value }))}
                      className="w-full min-h-[100px] rounded-xl bg-muted/30 border-none p-3 text-sm font-medium resize-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={createMutation.isPending || form.phrases.length < 2}
                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-500/20"
                  >
                    {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Train Intent'}
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
