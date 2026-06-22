"use client";

import React, { useState, useEffect } from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Code,
  Eye,
  EyeOff,
  MoreVertical,
  Terminal,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { createDeveloperKey, deleteDeveloperKey, getDeveloperKeys } from '@/lib/api/settings';

export default function DeveloperKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  // Full keys are only returned once at creation — remember them for reveal/copy.
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});

  const loadKeys = async () => {
    try {
      const res: any = await getDeveloperKeys();
      setKeys(res?.data || []);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKeys(); }, []);

  const handleGenerateKey = async () => {
    const name = window.prompt('Name for the new API key:', 'New API Key');
    if (name === null) return;
    try {
      const res: any = await createDeveloperKey(name || 'New API Key');
      const created = res?.data;
      if (created?.key) {
        setRevealedKeys(prev => ({ ...prev, [created.id || created.key]: created.key }));
        navigator.clipboard.writeText(created.key).catch(() => {});
        toast.success('API key created and copied — store it safely, it is shown only once');
      }
      await loadKeys();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create API key');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm('Revoke this API key? Integrations using it will stop working immediately.')) return;
    try {
      await deleteDeveloperKey(id);
      toast.success('API key revoked');
      await loadKeys();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const CURL_EXAMPLE = `curl -X POST https://api.wapi.app/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "919876543210",
    "type": "text",
    "text": "Hello platform!"
  }'`;

  return (

      <div className="flex flex-col gap-8">
        
        {/* Developer Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              Securely manage keys to authenticate your external integrations.
            </p>
          </div>
          <Button onClick={handleGenerateKey} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 h-11 px-6 rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Generate New Key
          </Button>
        </div>

        {/* Security Alert */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 p-4 rounded-2xl flex gap-4 items-start shadow-sm">
           <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
              <ShieldCheck className="h-5 w-5" />
           </div>
           <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Keep your keys private</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/60 leading-relaxed">
                 API keys provide full access to your WhatsApp workspace. Never commit these keys to version control or share them in client-side code. If a key is compromised, revoke it immediately.
              </p>
           </div>
        </div>

        {/* Keys List */}
        <div className="grid grid-cols-1 gap-6">
           {keys.map((key) => (
             <Card key={key.id} className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl group overflow-hidden shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-0">
                   <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <Key className="h-6 w-6" />
                         </div>
                         <div>
                            <div className="flex items-center gap-3 mb-1">
                               <h3 className="font-bold text-lg tracking-tight">{key.name}</h3>
                               <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none font-bold text-[10px] uppercase tracking-widest px-2">Active</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Created on {key.createdAt}</p>
                         </div>
                      </div>

                      <div className="flex-1 max-w-xl">
                         <div className="relative group/key">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                               <Terminal className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Input
                              readOnly
                              value={showKeyId === key.id ? (revealedKeys[key.id] || key.key) : key.key}
                              className="pl-10 pr-24 bg-accent/20 border-border/50 h-11 font-mono text-sm tracking-tight"
                            />
                            <div className="absolute inset-y-0 right-0 p-1 flex items-center gap-1">
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-9 w-9 text-muted-foreground"
                                 onClick={() => setShowKeyId(showKeyId === key.id ? null : key.id)}
                                 aria-label={showKeyId === key.id ? 'Hide API key' : 'Reveal API key'}
                               >
                                  {showKeyId === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                               </Button>
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-9 w-9 text-muted-foreground"
                                 onClick={() => copyToClipboard(revealedKeys[key.id] || key.key)}
                                 aria-label="Copy API key"
                               >
                                  <Copy className="h-4 w-4" />
                               </Button>
                            </div>
                         </div>
                      </div>

                      <div className="flex items-center gap-2">
                         <Button
                           variant="outline"
                           size="icon"
                           onClick={() => handleRevokeKey(key.id)}
                           className="h-11 w-11 rounded-xl border-border/50 text-red-500 hover:bg-red-50 transition-colors"
                           aria-label="Revoke API key"
                         >
                            <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                   </div>
                </CardContent>
             </Card>
           ))}
        </div>

        {/* Developer Quickstart */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl">
              <CardHeader>
                 <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Code className="h-5 w-5 text-primary" />
                    Curl Example
                 </CardTitle>
                 <CardDescription>Send a message using your API key</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="bg-slate-950 rounded-2xl p-4 font-mono text-[11px] text-slate-300 leading-6 relative group overflow-hidden shadow-inner">
                    <pre>
{`curl -X POST https://api.wapi.app/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "919876543210",
    "type": "text",
    "text": "Hello platform!"
  }'`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(CURL_EXAMPLE)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Copy curl example"
                    >
                       <Copy className="h-4 w-4" />
                    </button>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl">
              <CardHeader>
                 <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-primary" />
                    Documentation
                 </CardTitle>
                 <CardDescription>Explore our robust API reference</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-bold opacity-70">
                    Our API allow you to programmatically manage conversations, track delivery status, and automate customer engagement.
                 </p>
                 <div className="grid grid-cols-2 gap-3">
                    <Button asChild variant="outline" className="h-10 justify-start border-border/50 text-xs font-black uppercase tracking-widest bg-card transition-all rounded-xl hover:bg-accent">
                       <Link href="https://docs.wapi.com" target="_blank">
                          <ArrowUpRight className="h-3 w-3 mr-2" /> API Reference
                       </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-10 justify-start border-border/50 text-xs font-black uppercase tracking-widest bg-card transition-all rounded-xl hover:bg-accent">
                       <Link href="/settings/developer/webhooks">
                          <ArrowUpRight className="h-3 w-3 mr-2" /> Webhooks
                       </Link>
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>

      </div>
  );
}

function ArrowUpRight({ className, ...props }: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      {...props}
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}
