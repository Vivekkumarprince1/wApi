"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Zap,
  Package,
  DollarSign,
  Plus,
  Search,
  Pencil,
  Power,
  FileText,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { apiGet, apiPost } from "@/lib/api/client";
import { useAdminAuth } from "@/store/admin-auth-store";
import { PlanEditorDialog, type Plan } from "./plan-editor";

interface BillingStats {
  grossRevenue: number;
  activeSubs: number;
  planCount: number;
  pendingPayouts: number;
  churnRate: number;
  currency: string;
}

interface Invoice {
  _id: string;
  invoiceNumber?: string;
  workspaceName?: string;
  status?: string;
  totalCents?: number;
  currency?: string;
  billingPeriod?: string;
  issuedAt?: string;
}

function inr(rupees?: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees || 0);
}
function inrCents(cents?: number, currency = "INR"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(cents / 100);
}

export default function BillingPage() {
  const qc = useQueryClient();
  const can = useAdminAuth((s) => s.can);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["billing-stats"],
    queryFn: () => apiGet<BillingStats>("/api/admin/read/billing-stats"),
  });

  const { data: plansResp, isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<{ items: Plan[] }>("/api/admin/read/plans"),
  });
  const plans = useMemo(() => plansResp?.items ?? [], [plansResp]);

  const { data: invoicesResp, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", "archive"],
    queryFn: () => apiGet<{ items: Invoice[] }>("/api/admin/read/invoices"),
  });
  const invoices = invoicesResp?.items ?? [];

  const toggleStatus = useMutation({
    mutationFn: (plan: Plan) =>
      apiPost("/api/admin/ops/billing/update-plan", { planId: plan._id, isActive: !plan.isActive }),
    onSuccess: () => {
      toast.success("Plan status updated");
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["billing-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredPlans = plans.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.slug?.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(plan: Plan) {
    setEditing(plan);
    setEditorOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Billing & Plans"
        description="Subscription plans, pricing tiers and platform revenue"
        actions={
          can("billing") ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create plan
            </Button>
          ) : null
        }
      />
      <div className="p-6 space-y-6">
        {/* Revenue snapshot */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gross Revenue"
            value={stats ? inr(stats.grossRevenue) : undefined}
            loading={statsLoading}
            icon={TrendingUp}
            tone="emerald"
          />
          <StatCard
            label="Active Subscriptions"
            value={stats?.activeSubs?.toLocaleString()}
            loading={statsLoading}
            icon={Zap}
            tone="indigo"
          />
          <StatCard
            label="Plan Catalog"
            value={stats?.planCount?.toLocaleString() ?? String(plans.length)}
            loading={statsLoading}
            icon={Package}
            tone="amber"
            hint="Active tiers"
          />
          <StatCard
            label="Pending Payouts"
            value={stats ? inr(stats.pendingPayouts) : undefined}
            loading={statsLoading}
            icon={DollarSign}
            tone="slate"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Plan catalog */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Subscription Catalog</h2>
                <p className="text-sm text-muted-foreground">Manage tiered access plans.</p>
              </div>
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter plans…"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {plansLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)
              ) : filteredPlans.length ? (
                filteredPlans.map((plan) => (
                  <Card key={plan._id} className={plan.isActive ? "" : "opacity-70"}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{plan.name}</h3>
                            <Badge variant={plan.isActive ? "success" : "outline"}>
                              {plan.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{plan.slug}</p>
                        </div>
                        {can("billing") && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-semibold">
                          {inr((plan.monthlyBaseFeeCents ?? 0) / 100)}
                        </span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Max phones</p>
                          <p className="font-medium">{plan.maxActivePhones ?? "∞"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Features</p>
                          <p className="font-medium">{plan.features?.length ?? 0}</p>
                        </div>
                      </div>

                      {can("billing") && (
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!!plan.isActive}
                              onCheckedChange={() => toggleStatus.mutate(plan)}
                            />
                            <span className="text-xs text-muted-foreground">Active</span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                            <Power className="h-3.5 w-3.5" /> Configure
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No plans found.</p>
              )}
            </div>
          </div>

          {/* Invoice archive */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Invoice Archive</h2>
              <p className="text-sm text-muted-foreground">Platform settlement history.</p>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[560px] overflow-y-auto divide-y divide-border">
                  {invoicesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-4 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                    ))
                  ) : invoices.length ? (
                    invoices.map((inv) => (
                      <div key={inv._id} className="p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-muted-foreground">
                            #{inv.invoiceNumber || inv._id.slice(-8)}
                          </p>
                          <StatusBadge status={inv.status} />
                        </div>
                        <div className="mt-1 flex items-end justify-between">
                          <div>
                            <p className="text-sm font-medium">{inv.workspaceName || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {inv.billingPeriod ||
                                (inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "—")}
                            </p>
                          </div>
                          <p className="text-sm font-semibold">{inrCents(inv.totalCents, inv.currency)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center space-y-2">
                      <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">No invoices found.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <PlanEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        plan={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["plans"] });
          qc.invalidateQueries({ queryKey: ["billing-stats"] });
        }}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value?: string;
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "indigo" | "amber" | "slate";
  hint?: string;
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    indigo: "bg-indigo-500/10 text-indigo-600",
    amber: "bg-amber-500/10 text-amber-600",
    slate: "bg-slate-500/10 text-slate-600",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <p className="text-2xl font-semibold mt-1">{value ?? "—"}</p>
          )}
          {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
