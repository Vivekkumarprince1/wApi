"use client";

import React from 'react';
import { Terminal, Key, Webhook, Code2, Shield, ArrowRight, Zap, Copy, ExternalLink, Activity, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getDeveloperSettings } from '@/lib/api/settings';
import FlashLoader from '@/components/ui/flash-loader';
import { SnippetGenerator } from '@/components/dashboard/settings/developer/snippet-generator';

export default function DeveloperHubPage() {
  const { data: config, isLoading } = useQuery({
    queryKey: ['developer-settings'],
    queryFn: () => getDeveloperSettings()
  });

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                <Terminal className="h-8 w-8" />
            </div>
            <div>
                <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Developer Hub</h1>
                <p className="text-muted-foreground mt-1 font-medium flex items-center gap-2">
                    <Code2 className="h-4 w-4" /> Build custom integrations and manage API infrastructure.
                </p>
            </div>
        </div>
        <div className="flex gap-3">
             <Button asChild variant="outline" className="rounded-2xl px-6 font-bold border-border/50 h-12 text-xs uppercase tracking-widest bg-card shadow-sm hover:bg-accent transition-all">
                 <Link href="https://docs.wapi.com" target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" /> API Docs
                 </Link>
             </Button>
             <Button asChild className="rounded-2xl px-6 bg-slate-900 border-none hover:bg-slate-800 text-white shadow-lg font-black h-12 text-xs uppercase tracking-widest transition-all active:scale-95">
                 <Link href="/dashboard/settings/developer/keys">
                    <Shield className="mr-2 h-4 w-4" /> Credentials
                 </Link>
             </Button>
        </div>
      </div>

      {/* Hero Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Link href="/dashboard/settings/developer/keys" className="group">
            <Card className="border-none ring-1 ring-border/50 bg-card rounded-[48px] p-10 h-full transition-all group-hover:ring-primary/50 group-hover:shadow-2xl group-hover:shadow-primary/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                    <Key className="w-60 h-60" />
                </div>
                <div className="relative z-10 flex flex-col justify-between h-full space-y-10">
                    <div className="space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Key className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black tracking-tight">API Access Keys</h2>
                            <p className="text-muted-foreground font-bold leading-relaxed opacity-70">
                                Generate and manage secure keys to authenticate your custom applications with the wApi Cloud Messaging engine.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
                        Refine Keys <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </Card>
        </Link>

        <Link href="/dashboard/settings/developer/webhooks" className="group">
            <Card className="border-none ring-1 ring-border/50 bg-card rounded-[48px] p-10 h-full transition-all group-hover:ring-emerald-500/50 group-hover:shadow-2xl group-hover:shadow-emerald-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                    <Webhook className="w-60 h-60" />
                </div>
                <div className="relative z-10 flex flex-col justify-between h-full space-y-10">
                    <div className="space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <Webhook className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black tracking-tight">Webhooks & Events</h2>
                            <p className="text-muted-foreground font-bold leading-relaxed opacity-70">
                                Configure real-time event notifications for message delivery, read receipts, and incoming customer chats.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest text-xs">
                        Orchestrate Events <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </Card>
        </Link>
      </div>

      {/* Developer Snippet Generator Section */}
      <div className="space-y-8">
          <div className="flex items-center justify-between">
              <div className="space-y-1">
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tight">API Snippet Generator</h3>
                  <p className="text-sm font-medium text-muted-foreground">Select a template to generate production-ready code snippets.</p>
              </div>
          </div>
          <SnippetGenerator />
      </div>

      {/* Support & Documentation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-none ring-1 ring-border/50 bg-indigo-500/5 rounded-[40px] p-10 space-y-6">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                      <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Endpoint Specs</h3>
              </div>
              <div className="space-y-4">
                  <div className="space-y-2">
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Generic Template</p>
                      <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                          <code className="text-primary bg-primary/5 px-1.5 py-0.5 rounded">/messages/template</code> — High-throughput endpoint for marketing and utility messages.
                      </p>
                  </div>
                  <div className="space-y-2">
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Auth Specialization</p>
                      <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                          <code className="text-primary bg-primary/5 px-1.5 py-0.5 rounded">/auth/send-otp</code> — Optimized for OTP delivery with dedicated monitoring.
                      </p>
                  </div>
              </div>
          </Card>

          <Card className="border-none ring-1 ring-border/50 bg-slate-900 rounded-[40px] p-10 space-y-6 text-white relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                          <Shield className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Security Protocol</h3>
                  </div>
                  <p className="text-sm font-medium opacity-60 leading-relaxed">
                      API keys provide full access to your workspace. <strong>Never</strong> expose keys in client-side code. Always proxy requests through your backend server to ensure credential safety.
                  </p>
                  <Button variant="ghost" className="h-10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 rounded-xl px-0">
                      View Security Documentation <ArrowRight className="h-3 w-3 ml-2" />
                  </Button>
              </div>
              <div className="absolute -bottom-10 -right-10 h-40 w-40 bg-primary/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
          </Card>
      </div>

    </div>
  );
}
