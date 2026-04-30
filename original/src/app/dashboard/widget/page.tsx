"use client";

import React from 'react';
import { Grid, MousePointer2, Settings, Code, Sparkles, MessageCircle, Copy, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CloudWidgetHubPage() {
  const [copied, setCopied] = React.useState(false);

  const copySnippet = () => {
    navigator.clipboard.writeText('<script src="https://cdn.wapi.com/widget.js" data-id="YOUR_WIDGET_ID"></script>');
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
        <Button className="rounded-full px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold h-12 uppercase tracking-tight">
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
                    <Button variant="outline" className="rounded-full px-6 font-bold h-11 border-border/50">Edit Visuals</Button>
                    <Button variant="outline" className="rounded-full px-6 font-bold h-11 border-border/50">Behavior Settings</Button>
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
                    &lt;script src="https://cdn.wapi.com/widget.js" ...
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

      {/* Empty State */}
      <div className="bg-card border border-border/50 rounded-[40px] p-20 flex flex-col items-center text-center space-y-4 shadow-sm">
        <div className="w-20 h-20 rounded-[28px] bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-2">
          <Grid className="h-10 w-10" />
        </div>
        <h3 className="text-2xl font-black text-foreground">No Widgets Configured</h3>
        <p className="text-muted-foreground max-w-sm mx-auto font-medium">
            Deploy your first floating chat button or embedded contact form to start receiving chats from your site.
        </p>
        <Button variant="ghost" className="text-xs font-black uppercase tracking-widest text-primary mt-4 group">
            Integration Guide <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
