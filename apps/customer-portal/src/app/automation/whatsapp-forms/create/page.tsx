"use client";

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createWhatsAppForm } from '@/lib/api/automation';
import WhatsAppFormVisualEditor from '@/components/automation/whatsapp-form-visual-editor';

type MappingRow = {
  flowFieldId: string;
  crmField: string;
  saveAsTrait: boolean;
};

export default function CreateWhatsAppFormPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [flowType, setFlowType] = useState<'static' | 'dynamic'>('static');
  const [flowId, setFlowId] = useState('');
  const [category, setCategory] = useState('lead_capture');
  const [tagsCsv, setTagsCsv] = useState('');
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  const [rawFlowJson, setRawFlowJson] = useState('');
  const [visualPayload, setVisualPayload] = useState<{ screens: any[]; rawFlowJson: any }>({
    screens: [],
    rawFlowJson: { version: '1.0', screens: [] },
  });
  const [dataMappingJson, setDataMappingJson] = useState('[]');
  const [fallbackMessage, setFallbackMessage] = useState('Please update your WhatsApp to use interactive forms.');
  const [sendConfirmationMessage, setSendConfirmationMessage] = useState(true);
  const [confirmationText, setConfirmationText] = useState('Thanks, we have received your response.');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMethod, setWebhookMethod] = useState<'POST' | 'PUT'>('POST');

  const createMutation = useMutation({
    mutationFn: (payload: any) => createWhatsAppForm(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms'] });
      toast.success('Form created');
      router.push('/automation/whatsapp-forms');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create form'),
  });

  const handleVisualChange = useCallback((payload: { screens: any[]; rawFlowJson: any }) => {
    setVisualPayload(payload);
    if (editorMode === 'visual') {
      setRawFlowJson(JSON.stringify(payload.rawFlowJson, null, 2));
    }
  }, [editorMode]);

  const totalFields = visualPayload.screens.reduce((acc, screen: any) => {
    if (!Array.isArray(screen?.layout?.children)) return acc;
    return acc + screen.layout.children.length;
  }, 0);

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Form name is required');
      return;
    }

    let parsed: any = null;
    let parsedMapping: MappingRow[] = [];

    if (editorMode === 'visual') {
      parsed = visualPayload.rawFlowJson;
    } else if (rawFlowJson.trim()) {
      try {
        parsed = JSON.parse(rawFlowJson);
      } catch {
        toast.error('Invalid JSON payload');
        return;
      }
    }

    if (editorMode === 'visual' && (!Array.isArray(visualPayload.screens) || visualPayload.screens.length === 0)) {
      toast.error('Add at least one screen in visual builder');
      return;
    }

    if (dataMappingJson.trim()) {
      try {
        const mappingCandidate = JSON.parse(dataMappingJson);
        if (!Array.isArray(mappingCandidate)) {
          toast.error('Data mapping must be an array');
          return;
        }
        parsedMapping = mappingCandidate;
      } catch {
        toast.error('Invalid data mapping JSON');
        return;
      }
    }

    if (webhookEnabled && !webhookUrl.trim()) {
      toast.error('Webhook URL is required when webhook is enabled');
      return;
    }

    const tags = tagsCsv
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    createMutation.mutate({
      name,
      description,
      flowType,
      flowId: flowId || parsed?.flow_id || parsed?.flowId,
      rawFlowJson: parsed,
      screens: editorMode === 'visual' ? visualPayload.screens : (parsed?.screens || []),
      dataMapping: parsedMapping,
      category,
      tags,
      config: {
        fallbackMessage,
        sendConfirmationMessage,
        confirmationText,
      },
      webhookConfig: {
        enabled: webhookEnabled,
        url: webhookUrl || undefined,
        method: webhookMethod,
        headers: {},
      },
    });
  };

  return (
    <div className={`mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8 space-y-6 ${editorMode === 'visual' ? 'xl:pr-[390px]' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-5 lg:p-6">
        <div className="flex items-start gap-3">
	          <Link href="/automation/whatsapp-forms" aria-label="Back to WhatsApp Forms">
	            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl border border-border/60 bg-background/70"
              aria-label="Back to WhatsApp Forms"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Create WhatsApp Form</h1>
            <p className="text-sm text-muted-foreground">Design the user journey visually, configure delivery behavior, and save as draft.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-border/60 bg-background px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Screens</p>
            <p className="text-sm font-black">{visualPayload.screens.length}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fields</p>
            <p className="text-sm font-black">{totalFields}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mode</p>
            <p className="text-sm font-black">{editorMode === 'visual' ? 'Visual' : 'JSON'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-5 lg:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-black tracking-tight">Form Basics</h2>
          <p className="text-xs text-muted-foreground">Set up identity and purpose before building flow screens.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold">Form Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead Qualification Flow" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Flow ID (optional)</label>
            <Input value={flowId} onChange={(e) => setFlowId(e.target.value)} placeholder="meta-flow-id" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Collect qualification fields before handoff" />
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-5 lg:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight">Flow Builder</h2>
            <p className="text-xs text-muted-foreground">Switch between no-code visual editor and raw JSON.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={editorMode === 'visual' ? 'default' : 'outline'}
              onClick={() => setEditorMode('visual')}
            >
              Visual Builder
            </Button>
            <Button
              type="button"
              size="sm"
              variant={editorMode === 'json' ? 'default' : 'outline'}
              onClick={() => setEditorMode('json')}
            >
              JSON Editor
            </Button>
          </div>
        </div>

        {editorMode === 'visual' ? (
          <WhatsAppFormVisualEditor
            disabled={createMutation.isPending}
            onChange={handleVisualChange}
          />
        ) : (
          <textarea
            className="w-full min-h-[320px] rounded-2xl border border-border bg-background p-3 text-sm"
            value={rawFlowJson}
            onChange={(e) => setRawFlowJson(e.target.value)}
            placeholder='{"version":"1.0","screens":[]}'
          />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-base font-black tracking-tight">Flow Settings</h3>
            <p className="text-xs text-muted-foreground">Configure metadata used for routing and reporting.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Flow Type</label>
            <select
              className="w-full h-10 rounded-xl border border-border bg-background px-3"
              value={flowType}
              onChange={(e) => setFlowType(e.target.value as 'static' | 'dynamic')}
            >
              <option value="static">Static</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="lead_capture" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Tags (comma-separated)</label>
            <Input value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} placeholder="website, sales, high-intent" />
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-base font-black tracking-tight">Response Behavior</h3>
            <p className="text-xs text-muted-foreground">Define fallback and confirmation messages.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Fallback Message</label>
            <Input value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={sendConfirmationMessage} onChange={(e) => setSendConfirmationMessage(e.target.checked)} />
            Send confirmation after submission
          </label>

          <div className="space-y-2">
            <label className="text-sm font-bold">Confirmation Text</label>
            <Input value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} disabled={!sendConfirmationMessage} />
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-base font-black tracking-tight">Webhook Delivery</h3>
            <p className="text-xs text-muted-foreground">Optionally forward submissions to external systems.</p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={webhookEnabled} onChange={(e) => setWebhookEnabled(e.target.checked)} />
            Forward submissions to webhook
          </label>

          <div className="space-y-2">
            <label className="text-sm font-bold">Webhook URL</label>
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" disabled={!webhookEnabled} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Webhook Method</label>
            <select className="w-full h-10 rounded-xl border border-border bg-background px-3" value={webhookMethod} onChange={(e) => setWebhookMethod(e.target.value as 'POST' | 'PUT')} disabled={!webhookEnabled}>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black tracking-tight">CRM Data Mapping</h3>
            <p className="text-xs text-muted-foreground">Map form fields to contact traits or CRM columns.</p>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="rounded-xl border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => {
              const allFields: any[] = [];
              visualPayload.screens.forEach(screen => {
                if (Array.isArray(screen.layout?.children)) {
                  screen.layout.children.forEach((child: any) => {
                    allFields.push({
                      flowFieldId: child.name,
                      crmField: child.name,
                      saveAsTrait: true
                    });
                  });
                }
              });
              setDataMappingJson(JSON.stringify(allFields, null, 2));
              toast.success('Mapping template generated from screens');
            }}
          >
            Auto-generate Mapping
          </Button>
        </div>

        <textarea
          className="w-full min-h-[170px] rounded-2xl border border-border bg-background p-3 text-sm"
          value={dataMappingJson}
          onChange={(e) => setDataMappingJson(e.target.value)}
          placeholder='[{"flowFieldId":"email","crmField":"email","saveAsTrait":true}]'
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-3xl border border-border/60 bg-card p-5">
        <div className="text-xs text-muted-foreground">
          Form will be created as draft. Publish after validating fields and routing.
        </div>

        <div className="flex items-center gap-3">
        <Link href="/automation/whatsapp-forms">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Draft'}
        </Button>
        </div>
      </div>

    </div>
  );
}
