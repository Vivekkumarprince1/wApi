"use client";

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Code,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  MessageCircle,
  MousePointer2,
  RefreshCcw,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getWidgetConfig,
  updateWidgetConfig,
  type WidgetConfig,
  type WidgetPosition,
} from '@/lib/api/widget';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const positions: Array<{ value: WidgetPosition; label: string }> = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
  { value: 'full-width-bottom', label: 'Full width bottom' },
];

const defaultDraft: WidgetConfig = {
  widgetId: '',
  enabled: false,
  phoneNumber: '',
  position: 'bottom-right',
  color: {
    primary: '#25D366',
    secondary: '#1ea652',
    text: '#ffffff',
  },
  greeting: {
    enabled: true,
    text: 'Welcome! How can we help?',
    subtext: '',
  },
  defaultMessage: 'Hello! Thanks for reaching out.',
  behavior: {
    showByDefault: false,
    buttonLabel: 'Chat with us',
    allowedPages: ['*'],
    excludedPages: [],
    delayBeforeShow: 0,
  },
  attribution: {
    enabled: true,
    customText: 'Powered by wApi',
  },
  usage: {
    sessionsThisMonth: 0,
    messagesThisMonth: 0,
    uniqueVisitorsThisMonth: 0,
  },
};

function mergeDraft(config?: WidgetConfig): WidgetConfig {
  return {
    ...defaultDraft,
    ...(config || {}),
    color: { ...defaultDraft.color, ...(config?.color || {}) },
    greeting: { ...defaultDraft.greeting, ...(config?.greeting || {}) },
    behavior: { ...defaultDraft.behavior, ...(config?.behavior || {}) },
    attribution: { ...defaultDraft.attribution, ...(config?.attribution || {}) },
    usage: { ...defaultDraft.usage, ...(config?.usage || {}) },
  };
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

function getPreviewFrameClasses(position: WidgetPosition) {
  if (position === 'bottom-left') return { button: 'left-6 bottom-6', greeting: 'left-6 bottom-[104px]' };
  if (position === 'top-right') return { button: 'right-6 top-32', greeting: 'right-6 top-[210px]' };
  if (position === 'top-left') return { button: 'left-6 top-32', greeting: 'left-6 top-[210px]' };
  if (position === 'full-width-bottom') return {
    button: 'left-6 right-6 bottom-6 justify-center',
    greeting: 'left-6 right-6 bottom-[104px]',
  };
  return { button: 'right-6 bottom-6', greeting: 'right-6 bottom-[104px]' };
}

export default function CloudWidgetHubPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = React.useState(false);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [appOrigin, setAppOrigin] = React.useState('');
  const [draft, setDraft] = React.useState<WidgetConfig>(defaultDraft);

  React.useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const {
    data: config,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['widget-config'],
    queryFn: getWidgetConfig,
  });

  const safeConfig = mergeDraft(config);
  const isConfigured = Boolean(safeConfig.phoneNumber);
  const isLive = Boolean(safeConfig.enabled && safeConfig.phoneNumber);
  const previewPlacement = getPreviewFrameClasses(safeConfig.position);
  const runtimeUrl = `${appOrigin || ''}/widget/runtime.js`;
  const snippet = safeConfig.widgetId
    ? `<script src="${runtimeUrl}" data-wapi-id="${safeConfig.widgetId}" async></script>`
    : '';

  const saveMutation = useMutation({
    mutationFn: (payload: WidgetConfig) => updateWidgetConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget-config'] });
      setIsEditorOpen(false);
      toast.success('Widget configuration saved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save widget config'),
  });

  const openEditor = () => {
    setDraft(mergeDraft(config));
    setIsEditorOpen(true);
  };

  const copySnippet = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const saveDraft = () => {
    if (draft.enabled && !draft.phoneNumber.trim()) {
      toast.error('Phone number is required before enabling the widget');
      return;
    }
    saveMutation.mutate(draft);
  };

  const openWhatsAppTest = () => {
    if (!safeConfig.phoneNumber) {
      toast.error('Add a WhatsApp phone number first');
      return;
    }
    const phone = safeConfig.phoneNumber.replace(/[^\d]/g, '');
    const text = encodeURIComponent(safeConfig.defaultMessage || 'Hello');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Widget config could not load</h1>
          <p className="mt-1 text-sm text-muted-foreground">The service did not return the saved widget configuration.</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 pb-16">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Website Widget</h1>
            <Badge variant={isLive ? 'success' : 'outline'}>{isLive ? 'Live' : isConfigured ? 'Paused' : 'Not configured'}</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Add a small WhatsApp button to your website. Visitors click it, WhatsApp opens with your prefilled message, and the click is tracked here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={copySnippet} disabled={!isConfigured || !appOrigin} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy snippet'}
          </Button>
          <Button onClick={openEditor} className="gap-2">
            <Settings className="h-4 w-4" /> Configure
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          {
            title: '1. Configure',
            body: 'Set your WhatsApp number, button text, greeting, color, and enable the widget.',
          },
          {
            title: '2. Install',
            body: 'Copy the snippet and paste it before the closing body tag on your website.',
          },
          {
            title: '3. Convert',
            body: 'Website visitors start WhatsApp chats without searching for your number.',
          },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card className="rounded-xl">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-medium">Live Preview</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is how the widget appears on a website. Use the test button to confirm the WhatsApp link.
                </p>
              </div>
              <Button variant="outline" onClick={openWhatsAppTest} disabled={!isConfigured} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Test WhatsApp
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="relative min-h-[430px] overflow-hidden rounded-lg border border-border bg-background">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <div className="ml-2 min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                  your-website.com
                </div>
              </div>

              <div className="absolute left-5 right-5 top-16 z-10 flex flex-col gap-3 rounded-lg border border-border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {isLive ? 'Saved widget is live in preview' : isConfigured ? 'Saved widget is paused' : 'Widget needs a phone number'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {isConfigured ? `${safeConfig.phoneNumber} - ${positions.find((item) => item.value === safeConfig.position)?.label}` : 'Configure the widget to generate the button and embed snippet.'}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={openWhatsAppTest} disabled={!isConfigured} className="gap-2">
                  <ExternalLink className="h-3.5 w-3.5" /> Open test
                </Button>
              </div>

              <div className="grid gap-4 p-5 pt-36 sm:grid-cols-2">
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
                  <div className="h-3 w-28 rounded-full bg-muted" />
                  <div className="h-2 w-full rounded-full bg-muted/70" />
                  <div className="h-2 w-4/5 rounded-full bg-muted/70" />
                </div>
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
                  <div className="h-3 w-24 rounded-full bg-muted" />
                  <div className="h-2 w-full rounded-full bg-muted/70" />
                  <div className="h-2 w-3/4 rounded-full bg-muted/70" />
                </div>
                <div className="h-28 rounded-md border border-border bg-muted/20 sm:col-span-2" />
              </div>
              {safeConfig.greeting.enabled && safeConfig.greeting.text ? (
                <div className={`absolute z-20 ${previewPlacement.greeting} max-w-[340px] rounded-xl border border-border bg-background p-4 text-sm font-medium shadow-lg`}>
                  {safeConfig.greeting.text}
                </div>
              ) : null}
              <button
                type="button"
                onClick={openWhatsAppTest}
                disabled={!isConfigured}
                className={`absolute z-20 flex min-h-14 min-w-[176px] items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-xl ring-4 ring-background transition hover:scale-[1.01] hover:opacity-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${previewPlacement.button}`}
                style={{ backgroundColor: safeConfig.color.primary, color: safeConfig.color.text }}
              >
                <MessageCircle className="h-4 w-4" />
                {safeConfig.behavior.buttonLabel}
              </button>
              {!isLive ? (
                <div className="absolute left-5 top-36 z-20 max-w-sm rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                  <div className="flex gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      {isConfigured
                        ? 'Preview is testable, but the public widget is paused until you enable it.'
                        : 'Add your WhatsApp number to make this preview and snippet functional.'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="rounded-xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Code className="h-4 w-4" /> Embed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Benefit</p>
                <p className="mt-1 text-muted-foreground">
                  This converts website visitors into WhatsApp conversations, so your team can reply from the existing inbox instead of losing leads on the website.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <code className="block break-all text-xs text-muted-foreground">
                  {isConfigured ? snippet : 'Configure a phone number to generate your snippet.'}
                </code>
              </div>
              <Button onClick={copySnippet} disabled={!isConfigured || !appOrigin} variant="outline" className="w-full gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied to clipboard' : 'Copy embed code'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-base font-medium">Current Config</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Phone</span>
                <span className="truncate font-medium">{safeConfig.phoneNumber || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Position</span>
                <span className="font-medium">{positions.find((item) => item.value === safeConfig.position)?.label}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Button</span>
                <span className="truncate font-medium">{safeConfig.behavior.buttonLabel}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Widget impressions', value: safeConfig.usage.sessionsThisMonth, icon: MousePointer2 },
          { label: 'Chats started', value: safeConfig.usage.messagesThisMonth, icon: MessageCircle },
          { label: 'Unique clicks', value: safeConfig.usage.uniqueVisitorsThisMonth, icon: ArrowRight },
        ].map((item) => (
          <Card key={item.label} className="rounded-xl">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(item.value)}</p>
              </div>
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {!isConfigured ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <h2 className="text-base font-medium">No widget is configured yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add a WhatsApp number and enable the widget to make the embed snippet live.</p>
          <Button onClick={openEditor} className="mt-4 gap-2">
            Configure widget <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Widget Configuration</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div>
                <Label className="text-sm font-medium">Enable widget</Label>
                <p className="text-xs text-muted-foreground">The public script renders only when this is enabled and a phone number is set.</p>
              </div>
              <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="widget-phone">WhatsApp phone number</Label>
                <Input
                  id="widget-phone"
                  value={draft.phoneNumber}
                  onChange={(event) => setDraft((current) => ({ ...current, phoneNumber: event.target.value }))}
                  placeholder="919876543210"
                />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={draft.position} onValueChange={(position: WidgetPosition) => setDraft((current) => ({ ...current, position }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((position) => (
                      <SelectItem key={position.value} value={position.value}>{position.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[120px_1fr_1fr]">
              <div className="space-y-2">
                <Label htmlFor="widget-color">Color</Label>
                <input
                  id="widget-color"
                  type="color"
                  value={draft.color.primary}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    color: { ...current.color, primary: event.target.value, secondary: event.target.value },
                  }))}
                  className="h-10 w-full rounded-md border border-border bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="button-label">Button label</Label>
                <Input
                  id="button-label"
                  value={draft.behavior.buttonLabel}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    behavior: { ...current.behavior, buttonLabel: event.target.value },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="show-delay">Show delay seconds</Label>
                <Input
                  id="show-delay"
                  type="number"
                  min={0}
                  value={draft.behavior.delayBeforeShow}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    behavior: { ...current.behavior, delayBeforeShow: Number(event.target.value || 0) },
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="greeting">Greeting text</Label>
              <Textarea
                id="greeting"
                value={draft.greeting.text}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  greeting: { ...current.greeting, text: event.target.value },
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-message">Default WhatsApp message</Label>
              <Textarea
                id="default-message"
                value={draft.defaultMessage}
                onChange={(event) => setDraft((current) => ({ ...current, defaultMessage: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
            <Button onClick={saveDraft} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saveMutation.isPending ? 'Saving...' : 'Save widget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
