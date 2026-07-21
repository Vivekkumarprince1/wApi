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
  Plus,
  Trash2,
  Eye,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost } from "@/lib/api/client";
import { useAdminAuth } from "@/store/admin-auth-store";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

interface PartnerApp {
  appId?: string;
  id?: string;
  name?: string;
  appName?: string;
  phone?: string;
  status?: string;
  mode?: string;
  environment?: string;
  currentLimit?: string | number;
  qualityRating?: string;
  DockerDetails?: { health?: string;[key: string]: unknown };
  CappingDetails?: { dailyLimit?: number; used?: number;[key: string]: unknown };
  [key: string]: unknown;
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
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ appName: "", apiKey: "" });
  const [deleteTarget, setDeleteTarget] = useState<PartnerApp | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [selectedApp, setSelectedApp] = useState<PartnerApp | null>(null);
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

  const { data: partnerAppsResponse, isLoading: appsLoading, isFetching: appsFetching, refetch: refetchPartnerApps } = useQuery({
    queryKey: ["gupshup-partner-apps"],
    queryFn: () => apiPost<{ ok: boolean; data: PartnerApp[] }>("/api/admin/ops/gupshup/partner-apps"),
  });
  const partnerApps = partnerAppsResponse?.data ?? [];

  const linkApp = useMutation({
    mutationFn: () => apiPost("/api/admin/ops/gupshup/link-app", linkForm),
    onSuccess: () => {
      toast.success("App linked to the Gupshup partner account");
      setLinkForm({ appName: "", apiKey: "" });
      setLinkOpen(false);
      qc.invalidateQueries({ queryKey: ["gupshup-partner-apps"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSandboxApp = useMutation({
    mutationFn: (app: PartnerApp) => apiPost("/api/admin/ops/gupshup/delete-sandbox-app", {
      appId: partnerAppId(app),
      comment: "Deleted from ConnectSphere super admin",
    }),
    onSuccess: () => {
      toast.success("Sandbox app deleted from Gupshup");
      setDeleteTarget(null);
      setDeleteConfirmation("");
      setSelectedApp(null);
      qc.invalidateQueries({ queryKey: ["gupshup-partner-apps"] });
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

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Partner App Inventory</CardTitle>
              <CardDescription>All applications on this Gupshup partner account, including unassigned sandbox and live apps.</CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => refetchPartnerApps()} disabled={appsFetching}>
                <RefreshCw className={`h-4 w-4 ${appsFetching ? "animate-spin" : ""}`} /> Refresh
              </Button>
              {editable && <Button size="sm" onClick={() => setLinkOpen(true)}><Plus className="h-4 w-4" /> Link app</Button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader><TableRow><TableHead>Application</TableHead><TableHead>Environment</TableHead><TableHead>Phone</TableHead><TableHead>Health</TableHead><TableHead>Messaging limit</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {appsLoading ? Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) : partnerApps.length ? partnerApps.map((app) => {
                  const appId = partnerAppId(app);
                  const sandbox = isSandboxApp(app);
                  return <TableRow key={appId || app.name}>
                    <TableCell><p className="font-medium">{String(app.name || app.appName || "Unnamed app")}</p><p className="font-mono text-xs text-muted-foreground">{appId || "No app ID"}</p></TableCell>
                    <TableCell><Badge variant={sandbox ? "secondary" : "outline"}>{sandbox ? "Sandbox" : String(app.status || app.mode || app.environment || "Live")}</Badge></TableCell>
                    <TableCell>{String(app.phone || "—")}</TableCell>
                    <TableCell><StatusBadge status={String(app.DockerDetails?.health || app.status || "unknown")} /></TableCell>
                    <TableCell>{formatCapping(app)}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" aria-label={`View ${appId} details`} onClick={() => setSelectedApp(app)}><Eye className="h-4 w-4" /></Button>{editable && sandbox && <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Delete ${appId}`} onClick={() => { setDeleteTarget(app); setDeleteConfirmation(""); }}><Trash2 className="h-4 w-4" /></Button>}</div></TableCell>
                  </TableRow>;
                }) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No partner apps found.</TableCell></TableRow>}
              </TableBody>
            </Table>
            {selectedApp && <div className="rounded-lg border bg-muted/30 p-4"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Provider details · {partnerAppId(selectedApp)}</p><Button variant="ghost" size="sm" onClick={() => setSelectedApp(null)}>Close</Button></div><pre className="max-h-72 overflow-auto text-xs leading-5">{JSON.stringify(selectedApp, null, 2)}</pre></div>}
          </CardContent>
        </Card>

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

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent><DialogHeader><DialogTitle>Link Gupshup app</DialogTitle><DialogDescription>Enter the app name and its Gupshup API key. The key is sent directly to Gupshup and is not stored by ConnectSphere.</DialogDescription></DialogHeader>
          <div className="space-y-3"><Input placeholder="App name" value={linkForm.appName} onChange={(event) => setLinkForm((form) => ({ ...form, appName: event.target.value }))} /><Input type="password" autoComplete="off" placeholder="Gupshup API key" value={linkForm.apiKey} onChange={(event) => setLinkForm((form) => ({ ...form, apiKey: event.target.value }))} /></div>
          <DialogFooter showCloseButton><Button onClick={() => linkApp.mutate()} disabled={!linkForm.appName.trim() || !linkForm.apiKey.trim() || linkApp.isPending}>{linkApp.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Link app</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Delete sandbox app?</DialogTitle><DialogDescription>This permanently deletes <span className="font-mono">{partnerAppId(deleteTarget || {})}</span> in Gupshup. Live apps cannot be deleted here. Type the app ID to confirm.</DialogDescription></DialogHeader>
          <Input autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={partnerAppId(deleteTarget || {})} />
          <DialogFooter showCloseButton><Button variant="destructive" onClick={() => deleteTarget && deleteSandboxApp.mutate(deleteTarget)} disabled={deleteConfirmation !== partnerAppId(deleteTarget || {}) || deleteSandboxApp.isPending}>{deleteSandboxApp.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete sandbox app</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function partnerAppId(app: PartnerApp | Record<string, never>) {
  return String(app.appId || app.id || "");
}

function isSandboxApp(app: PartnerApp) {
  return [app.status, app.mode, app.environment, app.appMode, app.type, app.category]
    .some((value) => String(value || "").toLowerCase().includes("sandbox"));
}

function formatCapping(app: PartnerApp) {
  const capping = app.CappingDetails;
  if (capping?.dailyLimit != null) return `${capping.used ?? 0} / ${capping.dailyLimit}`;
  return app.currentLimit != null ? String(app.currentLimit) : "—";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
