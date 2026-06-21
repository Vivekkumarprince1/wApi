"use client";

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import FlashLoader from '@/components/ui/flash-loader';
import { exportWhatsAppFormResponses, fetchWhatsAppFormResponses } from '@/lib/api/automation';

export default function WhatsAppFormResponsesPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-form-responses', id, status],
    queryFn: () => fetchWhatsAppFormResponses(id, { status }),
    enabled: !!id,
  });

  const form = data?.data?.form;
  const responses = data?.data?.responses || [];

  const downloadCsv = async () => {
    try {
      const blob = await exportWhatsAppFormResponses(id, status);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${form?.name || 'whatsapp-form'}-responses.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (error: any) {
      toast.error(error?.message || 'Export failed');
    }
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/automation/whatsapp-forms">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Form Responses</h1>
            <p className="text-muted-foreground">{form?.name || 'Unknown form'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <Button variant="outline" className="gap-2" onClick={downloadCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-2xl font-black">{form?.statistics?.totalResponses || 0}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Completed</p>
          <p className="text-2xl font-black">{form?.statistics?.completedResponses || 0}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Completion</p>
          <p className="text-2xl font-black">{form?.statistics?.completionRate || 0}%</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Avg Time (sec)</p>
          <p className="text-2xl font-black">{Math.round(form?.statistics?.averageTimeSpent || 0)}</p>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border/50">
            <tr>
              <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Phone</th>
              <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Started</th>
              <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Completed</th>
              <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Fields</th>
            </tr>
          </thead>
          <tbody>
            {responses.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  No responses yet.
                </td>
              </tr>
            ) : (
              responses.map((response: any) => (
                <tr key={response._id} className="border-b last:border-b-0 border-border/30">
                  <td className="p-4 text-sm font-bold">{response.userPhone || '-'}</td>
                  <td className="p-4 text-sm">{response.status}</td>
                  <td className="p-4 text-sm text-muted-foreground">{response.startedAt ? new Date(response.startedAt).toLocaleString() : '-'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{response.completedAt ? new Date(response.completedAt).toLocaleString() : '-'}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    <div className="max-w-[420px] space-y-1">
                      {Object.entries(response.responses || {}).length === 0 ? (
                        <span>-</span>
                      ) : (
                        Object.entries(response.responses || {}).slice(0, 3).map(([key, value]) => (
                          <p key={key} className="truncate">
                            <span className="font-bold text-foreground">{key}:</span> {String(value)}
                          </p>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
