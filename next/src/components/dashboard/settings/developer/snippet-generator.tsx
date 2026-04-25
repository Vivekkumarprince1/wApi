"use client";

import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Terminal, 
  Copy, 
  Check, 
  Info, 
  ExternalLink,
  ChevronDown,
  Layers,
  Zap,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fetchTemplates, Template } from '@/lib/api/templates';
import api from '@/lib/axios';

interface ApiKey {
  id: string;
  name: string;
  key: string;
}

export function SnippetGenerator() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'curl' | 'fetch'>('curl');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [tplRes, keysRes] = await Promise.all([
          fetchTemplates({ status: 'APPROVED' }),
          api.get('/developer/keys')
        ]);

        const approvedTemplates = tplRes.data || [];
        setTemplates(approvedTemplates);
        if (approvedTemplates.length > 0) {
          setSelectedTemplate(approvedTemplates[0].name);
        }

        const keys = keysRes.data || [];
        setApiKeys(keys);
        if (keys.length > 0) {
          setSelectedKey(keys[0].key);
        }
      } catch (error) {
        console.error("Error loading snippet generator data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Snippet copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const getTemplateConfig = (tName: string) => {
    const template = templates.find(t => t.name === tName);
    if (!template) return { variables: '[]', hasMedia: false };

    let variablesArray = [];
    const bodyText = template.bodyText || template.body?.text || "";
    if (bodyText) {
      const matches = bodyText.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        variablesArray = Array.from({ length: matches.length }, (_, i) => `value${i + 1}`);
      }
    }

    const hasMedia = template.header?.enabled && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.header.format);

    return { 
      variables: JSON.stringify(variablesArray), 
      hasMedia,
      mediaType: template.header?.format || 'IMAGE'
    };
  };

  const { variables, hasMedia, mediaType } = getTemplateConfig(selectedTemplate);
  const apiUrl = "https://api.wapi.app/v1/external/messages/template";
  
  const payload: any = {
    phoneNumber: "+919876543210",
    templateName: selectedTemplate || 'template_name',
    variables: JSON.parse(variables)
  };

  if (hasMedia) {
    payload.headerMediaUrl = "https://example.com/image.jpg";
  }

  const curlSnippet = `curl -X POST ${apiUrl} \\
  -H "x-api-key: ${selectedKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;

  const fetchSnippet = `const sendMessage = async () => {
  const response = await fetch("${apiUrl}", {
    method: "POST",
    headers: {
      "x-api-key": "${selectedKey || 'YOUR_API_KEY'}",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(${JSON.stringify(payload, null, 4)})
  });

  const result = await response.json();
  console.log(result);
};`;

  if (loading && templates.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-card border border-border/50 rounded-[40px] animate-pulse">
        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Initializing Generator...</p>
      </div>
    );
  }

  return (
    <Card className="border-none ring-1 ring-border/50 bg-card rounded-[48px] overflow-hidden shadow-2xl transition-all hover:shadow-primary/5">
      <div className="grid grid-cols-1 lg:grid-cols-5 h-full min-h-[500px]">
        {/* Configuration Sidebar */}
        <div className="lg:col-span-2 p-10 border-b lg:border-b-0 lg:border-r border-border/50 bg-muted/5 flex flex-col justify-between">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                <Layers className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">Snippet Generator</h2>
                <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">Configure and export API examples.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 ml-1">Select Template</label>
                <div className="relative group">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-border/50 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {templates.map(t => (
                      <option key={t._id} value={t.name}>{t.name}</option>
                    ))}
                    {templates.length === 0 && <option value="">No templates found</option>}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 ml-1">Authentication Key</label>
                <div className="relative group">
                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 rounded-2xl bg-background border border-border/50 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {apiKeys.map(k => (
                      <option key={k.key} value={k.key}>{k.name}</option>
                    ))}
                    {apiKeys.length === 0 && <option value="">No API keys found</option>}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="pt-4 flex flex-wrap gap-2">
                {hasMedia && (
                  <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-500/20 font-black text-[9px] uppercase tracking-tighter px-3 py-1.5 rounded-full">
                    <Zap className="h-3 w-3 mr-1" /> Header Media: {mediaType}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-indigo-500/5 text-indigo-600 border-indigo-500/20 font-black text-[9px] uppercase tracking-tighter px-3 py-1.5 rounded-full">
                  <Globe className="h-3 w-3 mr-1" /> Variables: {JSON.parse(variables).length}
                </Badge>
              </div>
            </div>
          </div>

          <div className="pt-10 border-t border-border/10">
             <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground group cursor-pointer hover:text-primary transition-colors">
                <Info className="h-4 w-4" />
                <span>API keys should never be shared in client code.</span>
             </div>
          </div>
        </div>

        {/* Snippet Display */}
        <div className="lg:col-span-3 bg-slate-950 flex flex-col relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/2 relative z-10">
             <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('curl')}
                  className={`text-xs font-black uppercase tracking-widest transition-all relative py-2 ${activeTab === 'curl' ? 'text-primary' : 'text-white/40 hover:text-white'}`}
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" /> cURL
                  </span>
                  {activeTab === 'curl' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('fetch')}
                  className={`text-xs font-black uppercase tracking-widest transition-all relative py-2 ${activeTab === 'fetch' ? 'text-primary' : 'text-white/40 hover:text-white'}`}
                >
                  <span className="flex items-center gap-2">
                    <Code2 className="h-4 w-4" /> Fetch API
                  </span>
                  {activeTab === 'fetch' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  )}
                </button>
             </div>
             
             <Button 
              size="sm"
              onClick={() => copyToClipboard(activeTab === 'curl' ? curlSnippet : fetchSnippet)}
              className="h-10 rounded-xl px-4 bg-white/10 hover:bg-white/20 text-white font-black text-[10px] uppercase tracking-widest border-none transition-all active:scale-95"
             >
                {copied ? <Check className="h-3.5 w-3.5 mr-2 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                {copied ? "Copied" : "Copy Snippet"}
             </Button>
          </div>

          {/* Code */}
          <div className="flex-1 p-10 overflow-auto scrollbar-hide relative z-10 selection:bg-primary/30">
             <pre className="font-mono text-sm leading-relaxed text-indigo-200">
                {activeTab === 'curl' ? (
                  <div className="whitespace-pre-wrap">{curlSnippet}</div>
                ) : (
                  <div className="whitespace-pre-wrap">{fetchSnippet}</div>
                )}
             </pre>
          </div>

          {/* Footer Info */}
          <div className="px-8 py-4 border-t border-white/5 bg-white/1 flex items-center justify-between relative z-10">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/30">
                   <Badge className="bg-emerald-500/20 text-emerald-500 border-none h-4 px-1 rounded-sm text-[7px]">POST</Badge>
                   <span>application/json</span>
                </div>
             </div>
             <a href="https://docs.wapi.com" target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1.5">
                Full API Reference <ExternalLink className="h-3 w-3" />
             </a>
          </div>

          {/* Background Glow */}
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
        </div>
      </div>
    </Card>
  );
}
