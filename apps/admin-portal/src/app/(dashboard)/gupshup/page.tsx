"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  RefreshCw,
  Webhook,
  Radar,
  Smartphone,
  Globe,
  Link2Off,
  Building2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost } from "@/lib/api/client";
import { useAdminAuth } from "@/store/admin-auth-store";

interface GupshupHealth {
  mappedApps: number;
  whatsappConnected: number;
  orphanedMappings: number;
  totalWorkspaces: number;
  status?: string;
  lastCheckedAt?: string;
}
interface WaRequest {
  _id: string;
  workspaceName?: string;
  businessId?: string;
  phoneNumber?: string;
  status?: string;
}

export default function GupshupPage() {
  const qc = useQueryClient();
  const can = useAdminAuth((s) => s.can);
  const editable = can("operations");

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["gupshup-health"],
    queryFn: () => apiGet<GupshupHealth>("/api/admin/read/gupshup-health"),
  });

  const { data: requests, isLoading: reqLoading } = useQuery({
    queryKey: ["whatsapp-requests", "gupshup", 8],
    queryFn: () => apiGet<{ items: WaRequest[] }>("/api/admin/read/whatsapp-requests?page=1"),
  });

  const { data: config, isLoading: cfgLoading, refetch } = useQuery({
    queryKey: ["gupshup"],
    queryFn: () => apiGet<{ developerConfig: unknown; webhookPolicies: unknown }>("/api/admin/read/gupshup"),
  });

  const [configText, setConfigText] = useState("");
  useEffect(() => {
    if (config?.developerConfig) setConfigText(JSON.stringify(config.developerConfig, null, 2));
  }, [config]);

  const reconcile = useMutation({
    mutationFn: () => apiPost("/api/admin/ops/gupshup/reconcile"),
    onSuccess: () => {
      toast.success("Reconciliation triggered");
      qc.invalidateQueries({ queryKey: ["gupshup-health"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveConfig = useMutation({
    mutationFn: (payload: unknown) => apiPost("/api/admin/ops/gupshup/developer-config", payload),
    onSuccess: () => {
      toast.success("Developer config saved");
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSave() {
    try {
      saveConfig.mutate(JSON.parse(configText));
    } catch {
      toast.error("Invalid JSON");
    }
  }

  const cards = [
    { label: "Mapped Apps", value: health?.mappedApps, icon: Smartphone, tone: "emerald" },
    { label: "Connected Workspaces", value: health?.whatsappConnected, icon: Globe, tone: "emerald" },
    { label: "Orphaned Links", value: health?.orphanedMappings, icon: Link2Off, tone: "rose" },
    { label: "Total Workspaces", value: health?.totalWorkspaces, icon: Building2, tone: "slate" },
  ] as const;
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
    slate: "bg-slate-500/10 text-slate-600",
  };

  return (
    <>
      <PageHeader
        title="BSP Providers"
        description="Monitor partner health, app mappings, and provisioning across workspaces"
        actions={
          editable ? (
            <Button size="sm" variant="outline" disabled={reconcile.isPending} onClick={() => reconcile.mutate()}>
              {reconcile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reconcile Mapping
            </Button>
          ) : null
        }
      />
      <div className="p-6 space-y-6">
        {/* Health cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    {healthLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-semibold mt-1">{c.value ?? 0}</p>}
                  </div>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass[c.tone]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* BSP request queue */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Radar className="h-4 w-4 text-primary" /> BSP Request Queue</CardTitle>
              <CardDescription>Latest onboarding / provisioning requests.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {reqLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-5 w-full" /></div>)
                ) : requests?.items?.length ? (
                  requests.items.slice(0, 8).map((r) => (
                    <div key={r._id} className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                      <div><p className="text-xs text-muted-foreground">Workspace</p><p className="text-sm font-medium">{r.workspaceName}</p></div>
                      <div><p className="text-xs text-muted-foreground">Business ID</p><p className="text-sm font-mono">{r.businessId}</p></div>
                      <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm">{r.phoneNumber}</p></div>
                      <div className="text-right md:text-left"><StatusBadge status={r.status} /></div>
                    </div>
                  ))
                ) : (
                  <p className="p-8 text-center text-sm text-muted-foreground">No BSP requests.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Provider health panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider Health</CardTitle>
              <CardDescription>Partner connection snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Partner status" value={<StatusBadge status={health?.status} />} />
              <Row label="Last checked" value={health?.lastCheckedAt ? new Date(health.lastCheckedAt).toLocaleString() : "Unknown"} />
              <Row label="Orphaned mappings" value={String(health?.orphanedMappings ?? 0)} />
            </CardContent>
          </Card>
        </div>

        {/* Developer config + webhook policies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Developer config</CardTitle>
              <CardDescription>Gupshup developer configuration (env-managed).</CardDescription>
            </div>
            {editable && <Button size="sm" variant="outline" onClick={handleSave} disabled={saveConfig.isPending}><Save className="h-4 w-4" /> Save</Button>}
          </CardHeader>
          <CardContent>
            {cfgLoading ? <Skeleton className="h-40 w-full" /> : (
              <Textarea value={configText} onChange={(e) => setConfigText(e.target.value)} disabled={!editable} className="font-mono text-xs min-h-48" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhook policies</CardTitle>
            <CardDescription>Configured webhook delivery policies.</CardDescription>
          </CardHeader>
          <CardContent>
            {cfgLoading ? <Skeleton className="h-24 w-full" /> : (
              <pre className="text-xs overflow-x-auto max-h-64 rounded-md bg-muted/40 p-3">{JSON.stringify(config?.webhookPolicies ?? [], null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
