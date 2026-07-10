"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  KeyRound,
  MessageSquareText,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import config from '@/lib/config';
import { fetchTemplates, Template } from '@/lib/api/templates';
import { getDeveloperKeys } from '@/lib/api/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface ApiKey {
  id: string;
  name: string;
  key: string | null;
}

type UseCase = 'otp' | 'template';
type SnippetLanguage = 'curl' | 'node';

const API_KEY_PLACEHOLDER = 'YOUR_CONNECTSPHERE_API_KEY';

function normalizeApiBaseUrl(apiUrl: string) {
  const base = apiUrl.replace(/\/+$/, '');
  if (base.startsWith('http') && base.endsWith('/api/v1')) return base;
  if (base.startsWith('http') && base.endsWith('/api')) return `${base}/v1`;
  if (base.startsWith('http')) return `${base}/api/v1`;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5001/api/v1';
  }
  return 'https://api.connectsphere.app/api/v1';
}

function templateBody(template?: Template) {
  return template?.bodyText || template?.body?.text || '';
}

function extractVariables(template?: Template) {
  const body = templateBody(template);
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  return Array.from({ length: matches.length }, (_, index) => `value${index + 1}`);
}

function hasHeaderMedia(template?: Template) {
  const format = template?.header?.format;
  return Boolean(format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format));
}

function apiKeyLabel(key?: ApiKey) {
  if (!key) return 'No API key selected';
  return key.key ? `${key.name} (${key.key})` : key.name;
}

function codeFenceJson(value: unknown, spaces = 2) {
  return JSON.stringify(value, null, spaces);
}

export function SnippetGenerator() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [useCase, setUseCase] = useState<UseCase>('otp');
  const [language, setLanguage] = useState<SnippetLanguage>('curl');
  const [phoneVariable, setPhoneVariable] = useState('user.phone');
  const [purpose, setPurpose] = useState('login');
  const [ttlSeconds, setTtlSeconds] = useState('300');
  const [bodyVariablesText, setBodyVariablesText] = useState('[]');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [templateRes, keyRes] = await Promise.allSettled([
          fetchTemplates({ status: 'APPROVED' }),
          getDeveloperKeys(),
        ]);

        if (templateRes.status === 'fulfilled') {
          const approvedTemplates = (templateRes.value as any).data || templateRes.value || [];
          setTemplates(approvedTemplates);
          setSelectedTemplateId((approvedTemplates[0]?._id || approvedTemplates[0]?.id || '') as string);
        } else {
          setError('Approved templates could not be loaded.');
        }

        if (keyRes.status === 'fulfilled') {
          const keys = (keyRes.value as any).data || keyRes.value || [];
          setApiKeys(keys);
          setSelectedKeyId((keys[0]?.id || keys[0]?._id || '') as string);
        } else if (templateRes.status !== 'rejected') {
          setError('API keys could not be loaded.');
        }
      } catch {
        setError('Snippet generator could not be initialized.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => (template._id || template.id) === selectedTemplateId) || templates[0],
    [selectedTemplateId, templates]
  );

  const templateVariables = useMemo(() => extractVariables(selectedTemplate), [selectedTemplate]);
  const defaultBodyVariablesText = useMemo(() => codeFenceJson(templateVariables), [templateVariables]);
  const apiBaseUrl = normalizeApiBaseUrl(config.apiUrl);
  const languageCode = selectedTemplate?.language || 'en_US';
  const templateName = selectedTemplate?.name || 'meta_approved_template_name';
  const sendOtpUrl = `${apiBaseUrl}/external/otp/send`;
  const verifyOtpUrl = `${apiBaseUrl}/external/otp/verify`;
  const templateUrl = `${apiBaseUrl}/external/messages/template`;

  useEffect(() => {
    setBodyVariablesText(defaultBodyVariablesText);
  }, [defaultBodyVariablesText]);

  const parsedBodyVariables = useMemo(() => {
    try {
      const parsed = JSON.parse(bodyVariablesText);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [bodyVariablesText]);

  const sendOtpPayload = useMemo(() => ({
    phone: `+91\${${phoneVariable || 'user.phone'}}`,
    templateName,
    languageCode,
    purpose: purpose || 'login',
    ttlSeconds: Number(ttlSeconds) || 300,
    bodyVariables: parsedBodyVariables.length > 0 ? parsedBodyVariables.map((item) => item === 'value1' ? '{{otp}}' : item) : ['{{otp}}'],
  }), [languageCode, parsedBodyVariables, phoneVariable, purpose, templateName, ttlSeconds]);

  const verifyOtpPayload = useMemo(() => ({
    phone: `+91\${${phoneVariable || 'user.phone'}}`,
    purpose: purpose || 'login',
    otp: '123456',
  }), [phoneVariable, purpose]);

  const templatePayload = useMemo(() => ({
    phone: `+91\${${phoneVariable || 'user.phone'}}`,
    templateName,
    languageCode,
    bodyVariables: parsedBodyVariables,
    ...(hasHeaderMedia(selectedTemplate) ? { headerMediaUrl: 'https://example.com/invoice.pdf' } : {}),
  }), [languageCode, parsedBodyVariables, phoneVariable, selectedTemplate, templateName]);

  const curlSnippet = useMemo(() => {
    if (useCase === 'otp') {
      return `# 1) Send WhatsApp OTP\ncurl -X POST "${sendOtpUrl}" \\\n  -H "x-api-key: ${API_KEY_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '${codeFenceJson(sendOtpPayload)}'\n\n# 2) Verify OTP entered by the user\ncurl -X POST "${verifyOtpUrl}" \\\n  -H "x-api-key: ${API_KEY_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '${codeFenceJson(verifyOtpPayload)}'`;
    }

    return `curl -X POST "${templateUrl}" \\\n  -H "x-api-key: ${API_KEY_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '${codeFenceJson(templatePayload)}'`;
  }, [sendOtpPayload, sendOtpUrl, templatePayload, templateUrl, useCase, verifyOtpPayload, verifyOtpUrl]);

  const nodeSnippet = useMemo(() => {
    if (useCase === 'otp') {
      return `const CONNECTSPHERE_API_KEY = process.env.CONNECTSPHERE_API_KEY;\n\nexport async function sendWhatsappOtp(user) {\n  const response = await fetch("${sendOtpUrl}", {\n    method: "POST",\n    headers: {\n      "x-api-key": CONNECTSPHERE_API_KEY,\n      "content-type": "application/json"\n    },\n    body: JSON.stringify(${codeFenceJson(sendOtpPayload, 4)})\n  });\n\n  if (!response.ok) throw new Error(await response.text());\n  return response.json();\n}\n\nexport async function verifyWhatsappOtp(user, otp) {\n  const response = await fetch("${verifyOtpUrl}", {\n    method: "POST",\n    headers: {\n      "x-api-key": CONNECTSPHERE_API_KEY,\n      "content-type": "application/json"\n    },\n    body: JSON.stringify({\n      phone: \`+91\${${phoneVariable || 'user.phone'}}\`,\n      purpose: "${purpose || 'login'}",\n      otp\n    })\n  });\n\n  const result = await response.json();\n  return response.ok && result.verified === true;\n}`;
    }

    return `const CONNECTSPHERE_API_KEY = process.env.CONNECTSPHERE_API_KEY;\n\nexport async function sendTemplateMessage(user) {\n  const response = await fetch("${templateUrl}", {\n    method: "POST",\n    headers: {\n      "x-api-key": CONNECTSPHERE_API_KEY,\n      "content-type": "application/json"\n    },\n    body: JSON.stringify(${codeFenceJson(templatePayload, 4)})\n  });\n\n  if (!response.ok) throw new Error(await response.text());\n  return response.json();\n}`;
  }, [phoneVariable, purpose, sendOtpPayload, sendOtpUrl, templatePayload, templateUrl, useCase, verifyOtpUrl]);

  const activeSnippet = language === 'curl' ? curlSnippet : nodeSnippet;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    toast.success('Snippet copied');
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <div className="grid gap-4 rounded-lg border bg-card p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="min-h-[360px] w-full" />
      </div>
    );
  }

  if (error && templates.length === 0 && apiKeys.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="max-w-xl space-y-3">
          <h3 className="text-base font-semibold">Snippet generator unavailable</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const disabled = templates.length === 0 || apiKeys.length === 0;

  return (
    <Card className="overflow-hidden rounded-lg border bg-card shadow-none">
      <div className="grid min-h-[560px] lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="border-b bg-muted/20 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold">API Snippet Generator</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Use approved WhatsApp templates from your own backend.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-md">
              Server-side
            </Badge>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={useCase === 'otp' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => setUseCase('otp')}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                OTP
              </Button>
              <Button
                type="button"
                variant={useCase === 'template' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => setUseCase('template')}
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Approved template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={templates.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template._id || template.id} value={(template._id || template.id) as string}>
                      {template.name} · {template.language || 'en_US'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No approved Meta templates found. Sync or submit a template first.</p>
              ) : (
                <p className="line-clamp-2 text-xs text-muted-foreground">{templateBody(selectedTemplate) || 'Template body preview is not available.'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>API key</Label>
              <Select value={selectedKeyId} onValueChange={setSelectedKeyId} disabled={apiKeys.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Select API key" />
                </SelectTrigger>
                <SelectContent>
                  {apiKeys.map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      {apiKeyLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Created keys are shown once. Snippets use <code>{API_KEY_PLACEHOLDER}</code> so you can store the real key in server env.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone-variable">Phone variable</Label>
                <Input
                  id="phone-variable"
                  value={phoneVariable}
                  onChange={(event) => setPhoneVariable(event.target.value)}
                  placeholder="user.phone"
                />
              </div>
              {useCase === 'otp' ? (
                <div className="space-y-2">
                  <Label htmlFor="otp-purpose">Purpose</Label>
                  <Input
                    id="otp-purpose"
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                    placeholder="login"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Input value={languageCode} disabled />
                </div>
              )}
            </div>

            {useCase === 'otp' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ttl-seconds">OTP expiry</Label>
                  <Input
                    id="ttl-seconds"
                    type="number"
                    min="60"
                    max="1800"
                    value={ttlSeconds}
                    onChange={(event) => setTtlSeconds(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Variables</Label>
                  <Input value={`${Math.max(1, parsedBodyVariables.length)} body param`} disabled />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="body-variables">Body variables JSON</Label>
              <Textarea
                id="body-variables"
                value={bodyVariablesText}
                onChange={(event) => setBodyVariablesText(event.target.value)}
                className="min-h-24 font-mono text-xs"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                For OTP, use <code>{"{{otp}}"}</code> where the generated code should go.
              </p>
            </div>

            <div className="rounded-md border bg-background p-3">
              <div className="flex gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Call these endpoints from your backend only. Browser/mobile clients should call your server, then your server calls ConnectSphere with the API key.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col bg-slate-950 text-slate-100">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge className="rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20">POST</Badge>
                <p className="truncate font-mono text-xs text-slate-300">
                  {useCase === 'otp' ? '/external/otp/send + /external/otp/verify' : '/external/messages/template'}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {selectedTemplate ? `${selectedTemplate.name} · ${selectedTemplate.category || 'template'}` : 'Select a template to generate code'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={language === 'curl' ? 'secondary' : 'ghost'}
                className="text-slate-100 hover:bg-white/10 hover:text-white"
                onClick={() => setLanguage('curl')}
              >
                <Code2 className="mr-2 h-4 w-4" />
                cURL
              </Button>
              <Button
                type="button"
                size="sm"
                variant={language === 'node' ? 'secondary' : 'ghost'}
                className="text-slate-100 hover:bg-white/10 hover:text-white"
                onClick={() => setLanguage('node')}
              >
                <Server className="mr-2 h-4 w-4" />
                Node
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={copyToClipboard}
                disabled={disabled}
                className="bg-white text-slate-950 hover:bg-slate-200"
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                Copy
              </Button>
            </div>
          </div>

          {disabled ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <Send className="mx-auto h-8 w-8 text-slate-500" />
                <h4 className="mt-3 text-sm font-semibold">Create one API key and one approved template</h4>
                <p className="mt-2 text-sm text-slate-400">
                  After that, this panel will generate working OTP and template integration snippets.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <pre className="min-h-[430px] overflow-x-auto p-5 font-mono text-sm leading-6 text-slate-200">
                {activeSnippet}
              </pre>
            </ScrollArea>
          )}
        </div>
      </div>
    </Card>
  );
}
