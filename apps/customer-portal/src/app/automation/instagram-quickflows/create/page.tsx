"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createInstagramQuickflow, getInstagramQuickflow, updateInstagramQuickflow } from '@/lib/api/automation';

const PRESETS: Record<string, { name: string; type: string; triggerType: string; keywords: string[]; message: string }> = {
  price_please: {
    name: 'Price Please',
    type: 'price_please',
    triggerType: 'comment',
    keywords: ['price', 'cost', 'how much', '$'],
    message: 'Thanks for asking! Check your DMs for our latest pricing 📩',
  },
  giveaway: {
    name: 'Giveaway',
    type: 'giveaway',
    triggerType: 'comment',
    keywords: ['giveaway', 'contest', 'free'],
    message: "You're in! 🎁 We'll announce winners soon — keep an eye on your DMs.",
  },
  lead_gen: {
    name: 'Lead Generation',
    type: 'lead_gen',
    triggerType: 'dm',
    keywords: ['info', 'interested', 'tell me'],
    message: "Great to hear from you! Let's continue on WhatsApp so we can help you faster.",
  },
  story_auto_reply: {
    name: 'Story Auto-Reply',
    type: 'story_auto_reply',
    triggerType: 'story_reply',
    keywords: [],
    message: 'Thanks for reacting to our story! How can we help?',
  },
};

function QuickflowEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetId = searchParams.get('preset');
  const editId = searchParams.get('id');

  const [isLoading, setIsLoading] = useState(!!editId);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'custom',
    triggerType: 'comment',
    keywords: '',
    message: '',
  });

  useEffect(() => {
    if (presetId && PRESETS[presetId]) {
      const p = PRESETS[presetId];
      setForm({
        name: p.name,
        type: p.type,
        triggerType: p.triggerType,
        keywords: p.keywords.join(', '),
        message: p.message,
      });
    }
  }, [presetId]);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const res: any = await getInstagramQuickflow(editId);
        const qf = res?.data;
        if (qf) {
          setForm({
            name: qf.name || '',
            type: qf.type || 'custom',
            triggerType: qf.triggerType || 'comment',
            keywords: (qf.keywords || []).join(', '),
            message: qf.response?.message || '',
          });
        }
      } catch {
        toast.error('Failed to load quickflow');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [editId]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.message.trim()) { toast.error('Reply message is required'); return; }
    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      triggerType: form.triggerType,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      matchMode: 'contains',
      response: { message: form.message.trim() },
      enabled: true,
      preset: !!presetId,
      ...(presetId ? { presetName: presetId } : {}),
    };
    try {
      if (editId) {
        await updateInstagramQuickflow(editId, payload);
        toast.success('QuickFlow updated');
      } else {
        await createInstagramQuickflow(payload);
        toast.success('QuickFlow created');
      }
      router.push('/automation/instagram-quickflows');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save quickflow');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-32 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/automation/instagram-quickflows')} className="rounded-2xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{editId ? 'Edit QuickFlow' : 'New Instagram QuickFlow'}</h1>
          <p className="text-sm font-medium text-muted-foreground">Auto-respond to Instagram comments, DMs, and story replies.</p>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-[32px] p-8 space-y-6 shadow-sm">
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Flow Name</p>
          <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Price Inquiry Reply" className="h-12 rounded-xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trigger</p>
            <Select value={form.triggerType} onValueChange={(v) => setForm(f => ({ ...f, triggerType: v }))}>
              <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="comment">Post Comment</SelectItem>
                <SelectItem value="dm">Direct Message</SelectItem>
                <SelectItem value="story_reply">Story Reply</SelectItem>
                <SelectItem value="mention">Mention</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Keywords (comma separated)</p>
            <Input value={form.keywords} onChange={(e) => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="price, cost, how much" className="h-12 rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reply Message</p>
          <Textarea value={form.message} onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} rows={4} placeholder="The automatic reply sent when the trigger matches…" className="rounded-xl" />
        </div>

        <div className="pt-4 border-t border-border/20 flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push('/automation/instagram-quickflows')} className="rounded-xl h-12 px-6 font-bold">Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="rounded-xl h-12 px-8 font-black bg-pink-500 text-white hover:bg-pink-600">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {editId ? 'Save Changes' : 'Create QuickFlow'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InstagramQuickflowCreatePage() {
  return (
    <Suspense fallback={<div className="py-32 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-pink-500" /></div>}>
      <QuickflowEditor />
    </Suspense>
  );
}
