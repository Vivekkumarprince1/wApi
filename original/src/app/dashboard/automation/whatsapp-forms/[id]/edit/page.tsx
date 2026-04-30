"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FlashLoader from '@/components/ui/flash-loader';
import { getWhatsAppForm, updateWhatsAppForm } from '@/lib/api/automation';
import WhatsAppFormVisualEditor from '@/components/automation/whatsapp-form-visual-editor';

type MappingRow = {
  flowFieldId: string;
  crmField: string;
  saveAsTrait: boolean;
};

export default function EditWhatsAppFormPage() {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-form', id],
    queryFn: () => getWhatsAppForm(id),
    enabled: !!id,
  });

  const form = data?.data;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [flowType, setFlowType] = useState<'static' | 'dynamic'>('static');
  const [flowId, setFlowId] = useState('');
  const [category, setCategory] = useState('');
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
  const [confirmationText, setConfirmationText] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMethod, setWebhookMethod] = useState<'POST' | 'PUT'>('POST');

  useEffect(() => {
    if (form) {
      setName(form.name || '');
      setDescription(form.description || '');
      setFlowType(form.flowType || 'static');
      setFlowId(form.flowId || '');
      setCategory(form.category || '');
      setTagsCsv(Array.isArray(form.tags) ? form.tags.join(', ') : '');
      setRawFlowJson(form.rawFlowJson ? JSON.stringify(form.rawFlowJson, null, 2) : '');
      setDataMappingJson(JSON.stringify(form.dataMapping || [], null, 2));
      setFallbackMessage(form.config?.fallbackMessage || 'Please update your WhatsApp to use interactive forms.');
      setSendConfirmationMessage(form.config?.sendConfirmationMessage ?? true);
      setConfirmationText(form.config?.confirmationText || '');
      setWebhookEnabled(form.webhookConfig?.enabled || false);
      setWebhookUrl(form.webhookConfig?.url || '');
      setWebhookMethod(form.webhookConfig?.method || 'POST');
    }
  }, [form]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateWhatsAppForm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms'] });
      toast.success('Form updated');
      router.push('/dashboard/automation/whatsapp-forms');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update form'),
  });

  const initialVisualScreens = useMemo(() => {
    if (Array.isArray(form?.screens) && form.screens.length > 0) {
      return form.screens;
    }
    if (Array.isArray(form?.rawFlowJson?.screens) && form.rawFlowJson.screens.length > 0) {
      return form.rawFlowJson.screens;
    }
    return [];
  }, [form]);

  const handleVisualChange = useCallback((payload: { screens: any[]; rawFlowJson: any }) => {
    setVisualPayload(payload);
    if (editorMode === 'visual') {
      setRawFlowJson(JSON.stringify(payload.rawFlowJson, null, 2));
    }
  }, [editorMode]);

  if (isLoading) return <FlashLoader />;

  if (!form) {
    return <div className="p-8 text-sm text-muted-foreground">Form not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/automation/whatsapp-forms">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Edit WhatsApp Form</h1>
          <p className="text-muted-foreground">Published forms are locked until unpublished.</p>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold">Form Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={form.status === 'published'} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={form.status === 'published'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold">Flow Type</label>
            <select
              className="w-full h-10 rounded-xl border border-border bg-background px-3"
              value={flowType}
              onChange={(e) => setFlowType(e.target.value as 'static' | 'dynamic')}
              disabled={form.status === 'published'}
            >
              <option value="static">Static</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Flow ID</label>
            <Input value={flowId} onChange={(e) => setFlowId(e.target.value)} disabled={form.status === 'published'} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold">Category</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} disabled={form.status === 'published'} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Tags (comma-separated)</label>
            <Input value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} disabled={form.status === 'published'} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold">Meta Flow JSON</label>
          <div className="flex items-center gap-2 mb-2">
            <Button
              type="button"
              size="sm"
              variant={editorMode === 'visual' ? 'default' : 'outline'}
              onClick={() => setEditorMode('visual')}
              disabled={form.status === 'published'}
            >
              Visual Builder
            </Button>
            <Button
              type="button"
              size="sm"
              variant={editorMode === 'json' ? 'default' : 'outline'}
              onClick={() => setEditorMode('json')}
              disabled={form.status === 'published'}
            >
              JSON Editor
            </Button>
          </div>

          {editorMode === 'visual' ? (
            <WhatsAppFormVisualEditor
              initialScreens={initialVisualScreens}
              disabled={form.status === 'published' || updateMutation.isPending}
              onChange={handleVisualChange}
            />
          ) : (
            <textarea
              className="w-full min-h-[240px] rounded-2xl border border-border bg-background p-3 text-sm"
              value={rawFlowJson}
              onChange={(e) => setRawFlowJson(e.target.value)}
              disabled={form.status === 'published'}
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold">Data Mapping JSON</label>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-8 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
              disabled={form.status === 'published'}
              onClick={() => {
                const allFields: any[] = [];
                const screensToUse = editorMode === 'visual' ? visualPayload.screens : (form.screens || []);
                screensToUse.forEach((screen: any) => {
                  const children = screen.layout?.children || [];
                  children.forEach((child: any) => {
                    allFields.push({
                      flowFieldId: child.name,
                      crmField: child.name,
                      saveAsTrait: true
                    });
                  });
                });
                setDataMappingJson(JSON.stringify(allFields, null, 2));
                toast.success('Mapping template generated from screens');
              }}
            >
              Auto-generate Mapping
            </Button>
          </div>
          <textarea
            className="w-full min-h-[140px] rounded-2xl border border-border bg-background p-3 text-sm"
            value={dataMappingJson}
            onChange={(e) => setDataMappingJson(e.target.value)}
            disabled={form.status === 'published'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold">Fallback Message</label>
            <Input value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} disabled={form.status === 'published'} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Confirmation Text</label>
            <Input value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} disabled={form.status === 'published' || !sendConfirmationMessage} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={sendConfirmationMessage}
            onChange={(e) => setSendConfirmationMessage(e.target.checked)}
            disabled={form.status === 'published'}
          />
          Send confirmation message after submission
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={webhookEnabled}
            onChange={(e) => setWebhookEnabled(e.target.checked)}
            disabled={form.status === 'published'}
          />
          Forward submissions to webhook
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold">Webhook URL</label>
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} disabled={form.status === 'published' || !webhookEnabled} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Webhook Method</label>
            <select
              className="w-full h-10 rounded-xl border border-border bg-background px-3"
              value={webhookMethod}
              onChange={(e) => setWebhookMethod(e.target.value as 'POST' | 'PUT')}
              disabled={form.status === 'published' || !webhookEnabled}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/automation/whatsapp-forms">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            disabled={updateMutation.isPending || form.status === 'published'}
            onClick={() => {
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

              updateMutation.mutate({
                name,
                description,
                flowType,
                flowId: flowId || parsed?.flow_id || parsed?.flowId,
                rawFlowJson: parsed,
                screens: editorMode === 'visual' ? visualPayload.screens : (parsed?.screens || form.screens || []),
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
                  headers: form.webhookConfig?.headers || {},
                },
              });
            }}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
