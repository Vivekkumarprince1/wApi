"use client";

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWidgetConfig, updateWidgetConfig } from '@/lib/api/widget';
import { Grid, MousePointer2, Settings, Code, Sparkles, MessageCircle, Copy, Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function CloudWidgetHubPage() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ['widget-config'],
    queryFn: getWidgetConfig
  });
  const [copied, setCopied] = React.useState(false);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [form, setForm] = React.useState({ phoneNumber: '', themeColor: '#25D366', welcomeMessage: '' });

  const openEditor = () => {
    setForm({
      phoneNumber: (config as any)?.phoneNumber || '',
      themeColor: (config as any)?.themeColor || '#25D366',
      welcomeMessage: (config as any)?.welcomeMessage || 'Hi! How can we help you?',
    });
    setIsEditorOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => updateWidgetConfig(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget-config'] });
      setIsEditorOpen(false);
      toast.success('Widget configuration saved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save widget config'),
  });

  // Widget runtime URL is sourced from env so each deployment can point at
  // its own CDN/origin instead of the previous hard-coded `cdn.wapi.com`,
  // which never resolved.
  const widgetRuntimeUrl =
    process.env.NEXT_PUBLIC_WIDGET_URL || '/widget/runtime.js';
  const widgetId = (config as any)?.widgetId || 'YOUR_WIDGET_ID';
  const snippet = `<script src="${widgetRuntimeUrl}" data-id="${widgetId}"></script>`;
  const snippetPreview = `<script src="${widgetRuntimeUrl}" ...`;

  const copySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Grid className="h-8 w-8" />
            </div>
            <div>
                <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Cloud Widget</h1>
                <p className="text-muted-foreground mt-1 font-medium flex items-center gap-2">
                    <MousePointer2 className="h-4 w-4" /> Embed customizable WhatsApp chat buttons on any website.
                </p>
            </div>
        </div>
        <Button onClick={openEditor} className="rounded-full px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold h-12 uppercase tracking-tight">
          <Sparkles className="mr-2 h-4 w-4" /> Design New Widget
        </Button>
      </div>

      {/* Widget Concept Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none ring-1 ring-border/50 bg-card rounded-[48px] overflow-hidden shadow-sm relative group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-48 h-48" />
            </div>
            <div className="p-10 relative z-10 space-y-6">
                <Badge className="bg-indigo-500/10 text-indigo-600 border-none px-4 py-1 rounded-full font-black text-[10px] tracking-widest uppercase">Live Preview Available</Badge>
                <div className="space-y-2 max-w-lg">
                    <h2 className="text-3xl font-black tracking-tight">Your website, connected.</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        The wApi Cloud Widget allows your website visitors to start a WhatsApp conversation with a single click. Customize colors, icons, and automated welcome messages.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={openEditor} className="rounded-full px-6 font-bold h-11 border-border/50">Edit Visuals</Button>
                    <Button variant="outline" onClick={openEditor} className="rounded-full px-6 font-bold h-11 border-border/50">Behavior Settings</Button>
                </div>
            </div>
        </Card>

        <Card className="border-none ring-1 ring-border/50 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-[40px] p-8 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Code className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-black tracking-tight">Direct Embed</h3>
                <p className="text-indigo-100/70 text-xs font-medium leading-relaxed">
                    Paste this snippet before the closing &lt;/body&gt; tag of your website.
                </p>
            </div>
            <div className="mt-6 bg-black/20 rounded-2xl p-4 flex items-center justify-between border border-white/10 group cursor-pointer" onClick={copySnippet}>
                <code className="text-[10px] font-mono opacity-80 truncate mr-4">
                    {snippetPreview}
                </code>
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-white opacity-50 group-hover:opacity-100 transition-opacity" />}
            </div>
        </Card>
      </div>

      {/* Analytics Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
            { label: 'Widget Impressions', value: '0', icon: Sparkles },
            { label: 'Click-Through Rate', value: '0%', icon: MousePointer2 },
            { label: 'Chats Started', value: '0', icon: MessageCircle },
        ].map((stat, i) => (
            <Card key={i} className="border-none ring-1 ring-border/50 bg-card rounded-[32px] p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                <div className="flex items-center justify-between">
                    <h4 className="text-2xl font-black">{stat.value}</h4>
                    <stat.icon className="h-5 w-5 text-indigo-500 opacity-20" />
                </div>
            </Card>
        ))}
      </div>

      {/* Empty State / Config Details */}
      <div className="bg-card border border-border/50 rounded-[40px] p-20 flex flex-col items-center text-center space-y-4 shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
            <p className="text-sm font-bold text-muted-foreground">Loading Configuration...</p>
          </div>
        ) : !config || !config.phoneNumber ? (
          <>
            <div className="w-20 h-20 rounded-[28px] bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-2">
              <Grid className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-black text-foreground">No Widgets Configured</h3>
            <p className="text-muted-foreground max-w-sm mx-auto font-medium">
                Deploy your first floating chat button or embedded contact form to start receiving chats from your site.
            </p>
            <Button variant="ghost" onClick={openEditor} className="text-xs font-black uppercase tracking-widest text-primary mt-4 group">
                Configure Widget <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </Button>
          </>
        ) : (
          <div className="w-full max-w-2xl text-left space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase">Active Configuration</h3>
                <Badge variant="success">Online</Badge>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
                   <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Phone Number</p>
                   <p className="text-sm font-bold">{config.phoneNumber}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
                   <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Theme Color</p>
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.themeColor }}></div>
                      <p className="text-sm font-bold">{config.themeColor}</p>
                   </div>
                </div>
             </div>
             <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20">
                <p className="text-[10px] font-black uppercase text-primary mb-2 tracking-widest">Welcome Message</p>
                <p className="text-sm font-medium italic">"{config.welcomeMessage}"</p>
             </div>
          </div>
        )}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Widget Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">WhatsApp Phone Number</p>
              <Input
                value={form.phoneNumber}
                onChange={(e) => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="919876543210"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Theme Color</p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.themeColor}
                  onChange={(e) => setForm(f => ({ ...f, themeColor: e.target.value }))}
                  className="h-11 w-14 rounded-xl border border-border/50 bg-transparent cursor-pointer"
                />
                <Input
                  value={form.themeColor}
                  onChange={(e) => setForm(f => ({ ...f, themeColor: e.target.value }))}
                  className="h-11 rounded-xl font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Welcome Message</p>
              <Input
                value={form.welcomeMessage}
                onChange={(e) => setForm(f => ({ ...f, welcomeMessage: e.target.value }))}
                placeholder="Hi! How can we help you?"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button
              onClick={() => {
                if (!form.phoneNumber.trim()) { toast.error('Phone number is required'); return; }
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
              className="rounded-xl font-bold"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Widget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
