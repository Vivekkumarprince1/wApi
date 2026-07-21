"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2, Snowflake, UserCog, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api/client";
import { useAdminAuth } from "@/store/admin-auth-store";

interface Member {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  lastLoginAt?: string;
}
interface WorkspaceDetail {
  workspace: Record<string, unknown> & {
    _id: string;
    name?: string;
    billingStatus?: string;
    whatsappConnected?: boolean;
    owner?: { name?: string; email?: string };
    plan?: { _id?: string; name?: string; slug?: string; features?: string[] };
    planLimits?: { features?: string[] };
    createdAt?: string;
  };
  members: Member[];
  wallet?: { availableBalance?: number; parkedBalance?: number; currency?: string } | null;
  subscription?: { status?: string; currentPeriodEnd?: string } | null;
  invoices: Array<{
    _id: string;
    invoiceNumber?: string;
    status?: string;
    totalCents?: number;
    currency?: string;
    issuedAt?: string;
  }>;
}

interface PlanOption { _id: string; name: string; slug?: string; isActive?: boolean; features?: string[] }

const SERVICE_OPTIONS = [
  ["INBOX", "Shared Inbox"], ["CAMPAIGNS", "Campaigns"], ["CONTACTS", "Contacts"],
  ["TEMPLATES_LIBRARY", "Templates"], ["FLOW_HUB", "Flow Hub"], ["WORKFLOWS", "Workflows"],
  ["AUTOMATION", "Automation"], ["PIPELINE", "Sales Pipeline"], ["ANALYTICS", "Analytics"],
  ["TEAM_MGMT", "Team Management"], ["CATALOG", "Catalog"], ["INTEGRATIONS", "Integrations"],
] as const;

function money(cents?: number, currency = "INR"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(cents / 100);
}

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const can = useAdminAuth((s) => s.can);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["workspace", id],
    queryFn: () => apiGet<WorkspaceDetail>(`/api/admin/read/workspaces/${id}`),
  });
  const { data: planData } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<{ items: PlanOption[] }>("/api/admin/read/plans"),
    enabled: can("billing"),
  });
  const [serviceFeatures, setServiceFeatures] = useState<string[]>([]);

  const action = useMutation({
    mutationFn: (act: string) => apiPost(`/api/admin/ops/workspaces/${id}/${act}`),
    onSuccess: (_res, act) => {
      toast.success(`Workspace ${act}d`);
      qc.invalidateQueries({ queryKey: ["workspace", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const impersonate = useMutation({
    mutationFn: () => apiPost<{ targetUrl: string }>(`/api/admin/ops/impersonate/${id}`),
    onSuccess: (res) => {
      toast.success("Impersonation session created");
      if (res?.targetUrl) window.open(res.targetUrl, "_blank", "noopener");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const ws = data?.workspace;
  const hasServiceOverride = Array.isArray(ws?.planLimits?.features);
  useEffect(() => {
    setServiceFeatures(ws?.planLimits?.features || ws?.plan?.features || []);
  }, [ws?.planLimits?.features, ws?.plan?.features]);
  const frozen = ws?.billingStatus === "frozen";
  const suspended = ws?.billingStatus === "suspended";
  const setPlan = useMutation({
    mutationFn: (planId: string) => apiPost(`/api/admin/ops/workspaces/${id}/plan`, { planId }),
    onSuccess: () => {
      toast.success("Workspace plan updated; services now inherit from this plan");
      qc.invalidateQueries({ queryKey: ["workspace", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const saveServices = useMutation({
    mutationFn: (payload: { features?: string[]; reset?: boolean }) =>
      apiPost(`/api/admin/ops/workspaces/${id}/service-access`, payload),
    onSuccess: () => {
      toast.success("Workspace service access updated");
      qc.invalidateQueries({ queryKey: ["workspace", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title={ws?.name || "Workspace"}
        description="Workspace detail"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/workspaces">
              <Button size="sm" variant="outline">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            {can("workspaces") && data && (
              <Button size="sm" variant="ghost" disabled={impersonate.isPending} onClick={() => impersonate.mutate()}>
                <UserCog className="h-4 w-4" /> Impersonate
              </Button>
            )}
            {can("workspaces") && data && (
              <Button
                size="sm"
                variant="ghost"
                disabled={action.isPending}
                onClick={() => action.mutate(suspended ? "activate" : "suspend")}
              >
                {suspended ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                {suspended ? "Activate" : "Suspend"}
              </Button>
            )}
            {can("system") && data && (
              <Button
                size="sm"
                variant={frozen ? "outline" : "destructive"}
                disabled={action.isPending}
                onClick={() => action.mutate(frozen ? "unfreeze" : "freeze")}
              >
                {action.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Snowflake className="h-4 w-4" />}
                {frozen ? "Unfreeze" : "Emergency Freeze"}
              </Button>
            )}
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {isError ? (
          <p className="text-sm text-destructive">Failed to load workspace.</p>
        ) : isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={ws?.billingStatus} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-lg font-semibold mt-1">{ws?.plan?.name || "Unassigned"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <p className="text-sm font-medium mt-1">{ws?.owner?.email || "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="text-lg font-semibold mt-1">
                    {ws?.whatsappConnected ? "Connected" : "Not connected"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">Billing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet available</span>
                    <span>{money(data.wallet?.availableBalance, data.wallet?.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet parked</span>
                    <span>{money(data.wallet?.parkedBalance, data.wallet?.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subscription</span>
                    <StatusBadge status={data.subscription?.status} />
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Plan features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {ws?.plan?.features?.length
                      ? ws.plan.features.map((f) => (
                        <Badge key={f} variant="secondary">
                          {f}
                        </Badge>
                      ))
                      : <span className="text-sm text-muted-foreground">No features listed.</span>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {can("workspaces") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Plan & service access
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Assign a plan or grant this workspace a specific set of services. A service override takes precedence over the plan until reset.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {can("billing") && (
                    <div className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
                      <Label htmlFor="workspace-plan">Workspace plan</Label>
                      <Select value={ws?.plan?._id || ""} onValueChange={(planId) => setPlan.mutate(planId)} disabled={setPlan.isPending}>
                        <SelectTrigger id="workspace-plan"><SelectValue placeholder="Select a plan" /></SelectTrigger>
                        <SelectContent>
                          {(planData?.items || []).filter((plan) => plan.isActive !== false).map((plan) => (
                            <SelectItem key={plan._id} value={plan._id}>{plan.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="text-sm font-medium">Service override</p>
                      <p className="text-xs text-muted-foreground">{hasServiceOverride ? "Custom access is active for this workspace." : "Currently inheriting services from the selected plan."}</p>
                    </div>
                    {hasServiceOverride && (
                      <Button size="sm" variant="outline" disabled={saveServices.isPending} onClick={() => saveServices.mutate({ reset: true })}>
                        Reset to plan
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {SERVICE_OPTIONS.map(([key, label]) => {
                      const enabled = serviceFeatures.includes(key);
                      return (
                        <div key={key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                          <Label htmlFor={`service-${key}`} className="cursor-pointer text-sm">{label}</Label>
                          <Switch
                            id={`service-${key}`}
                            checked={enabled}
                            onCheckedChange={(checked) => setServiceFeatures((current) => checked ? [...new Set([...current, key])] : current.filter((feature) => feature !== key))}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" disabled={saveServices.isPending} onClick={() => saveServices.mutate({ features: serviceFeatures })}>
                      {saveServices.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save service access"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Members ({data.members.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.length ? (
                      data.members.map((m) => (
                        <TableRow key={m._id}>
                          <TableCell className="font-medium">{m.name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{m.email}</TableCell>
                          <TableCell>{m.role}</TableCell>
                          <TableCell>
                            <StatusBadge status={m.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          No members.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent invoices</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Issued</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invoices.length ? (
                      data.invoices.map((inv) => (
                        <TableRow key={inv._id}>
                          <TableCell className="font-medium">
                            {inv.invoiceNumber || inv._id.slice(-8)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={inv.status} />
                          </TableCell>
                          <TableCell className="text-right">{money(inv.totalCents, inv.currency)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          No invoices.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
