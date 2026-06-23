"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Play, Workflow } from 'lucide-react';
import { toast } from 'sonner';

import { getRuleById } from '@/lib/api/automation';
import { apiFetch } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FlashLoader from '@/components/ui/flash-loader';

export default function WorkflowViewPage() {
  const params = useParams();
  const id = String(params?.id || '');

  const { data, isLoading } = useQuery({
    queryKey: ['automation-rule', id],
    queryFn: () => getRuleById(id),
    enabled: !!id
  });

  const rule = data?.data;

  const runWorkflowTest = async () => {
    const conversationId = window.prompt('Enter conversation ID for test (optional):', '')?.trim() || '';
    const contactId = window.prompt('Enter contact ID for test (optional):', '')?.trim() || '';

    if (!conversationId && !contactId) {
      toast.error('Provide at least one ID (conversation or contact) to run a test.');
      return;
    }

    try {
      const response = await apiFetch(`/api/automation/engine/rules/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          contactId: contactId || undefined,
          messageBody: 'Manual workflow test'
        })
      });

      const raw = await response.text();
      const json = raw ? JSON.parse(raw) : null;

      if (!response.ok || !json?.success) {
        throw new Error(json?.error || `Failed to test workflow (${response.status})`);
      }

      toast.success('Workflow test executed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Workflow test failed');
    }
  };

  if (isLoading) return <FlashLoader />;

  if (!rule) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Workflow not found.</p>
        <Link href="/automation/workflows" className="inline-block mt-4">
          <Button variant="outline">Back to Workflows</Button>
        </Link>
      </div>
    );
  }

  const nodesCount = rule.flowConfig?.nodes?.length || 0;
  const edgesCount = rule.flowConfig?.edges?.length || 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link href="/automation/workflows" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <Workflow className="h-6 w-6" />
            {rule.name}
          </h1>
          <div className="flex items-center gap-2">
            <Badge>{rule.enabled ? 'Active' : 'Paused'}</Badge>
            <Badge variant="secondary">{rule.category || 'workflow'}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={runWorkflowTest}>
            <Play className="h-4 w-4 mr-2" /> Test
          </Button>
          <Link href={`/automation/workflows/builder/${rule._id}`}>
            <Button>
              <Pencil className="h-4 w-4 mr-2" /> Edit in Builder
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 bg-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Trigger</p>
          <p className="font-bold mt-2">{rule.trigger?.event || rule.trigger?.type || 'message_received'}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Nodes</p>
          <p className="font-bold mt-2">{nodesCount}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Connections</p>
          <p className="font-bold mt-2">{edgesCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border p-4 bg-card">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Execution</p>
        <p className="mt-2 text-sm">Total runs: <span className="font-bold">{rule.stats?.totalExecutions || 0}</span></p>
        <p className="mt-1 text-sm">Last executed: <span className="font-bold">{rule.stats?.lastExecutedAt ? new Date(rule.stats.lastExecutedAt).toLocaleString() : 'Never'}</span></p>
      </div>
    </div>
  );
}
