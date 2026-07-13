"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Building2,
  Users,
  CheckCircle2,
  MessageSquare,
  CreditCard,
  Wallet,
  Smartphone,
  Activity,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api/client";

interface DashboardData {
  stats: {
    totalWorkspaces: number;
    totalUsers: number;
    activeWorkspaces: number;
    totalMessages30d: number;
    activeSubscriptions: number;
    activeBSPs: number;
    grossRevenuePaise: number;
    currency: string;
  };
}
interface MonitoringData {
  services: Array<{ id: string; name: string; status: "up" | "down"; latencyMs: number | null }>;
}
interface Workspace {
  _id: string;
  name: string;
  owner?: { email?: string };
  plan?: { name?: string };
  whatsappConnected?: boolean;
}

function formatMoney(paise?: number, currency = "INR"): string {
  if (paise == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardData>("/api/admin/read/dashboard"),
  });
  const { data: monitoring } = useQuery({
    queryKey: ["monitoring", "dashboard"],
    queryFn: () => apiGet<MonitoringData>("/api/admin/read/monitoring"),
  });
  const { data: wsResp } = useQuery({
    queryKey: ["workspaces", "dashboard"],
    queryFn: () => apiGet<{ items: Workspace[] }>("/api/admin/read/workspaces"),
  });

  const s = data?.stats;
  const cards = [
    { label: "Total Workspaces", value: s?.totalWorkspaces?.toLocaleString(), icon: Building2 },
    { label: "Active Workspaces", value: s?.activeWorkspaces?.toLocaleString(), icon: CheckCircle2 },
    { label: "Total Users", value: s?.totalUsers?.toLocaleString(), icon: Users },
    { label: "Messages (30d)", value: s?.totalMessages30d?.toLocaleString(), icon: MessageSquare },
    { label: "Active Subscriptions", value: s?.activeSubscriptions?.toLocaleString(), icon: CreditCard },
    { label: "Active BSP Connections", value: s?.activeBSPs?.toLocaleString(), icon: Smartphone },
    { label: "Gross Revenue", value: s ? formatMoney(s.grossRevenuePaise, s.currency) : undefined, icon: Wallet },
  ];

  const workspaces = wsResp?.items ?? [];
  // Plan distribution
  const planCounts = new Map<string, number>();
  for (const w of workspaces) {
    const name = w.plan?.name || "Free Tier";
    planCounts.set(name, (planCounts.get(name) || 0) + 1);
  }
  const planDist = [...planCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const services = monitoring?.services ?? [];
  const allUp = services.length > 0 && services.every((x) => x.status === "up");

  return (
    <>
      <PageHeader title="Dashboard" description="Platform health, revenue, and workspace operations" />
      <div className="space-y-6 p-5 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,color-mix(in_oklch,var(--primary)_20%,transparent),transparent_35%)]"
            />
            <div className="relative min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Activity className="size-3.5" />
                {allUp ? "All systems nominal" : "Needs attention"}
              </div>
              <h2 className="max-w-2xl text-2xl font-semibold tracking-tight">Command center for the ConnectSphere platform.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Monitor workspace growth, subscriptions, BSP connectivity, and operational health from one control plane.
              </p>
            </div>
            <div className="relative grid min-w-[220px] grid-cols-2 gap-3 rounded-xl border border-border/70 bg-background/75 p-3 shadow-sm backdrop-blur">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
                <p className="mt-1 text-lg font-semibold">{s ? formatMoney(s.grossRevenuePaise, s.currency) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BSPs</p>
                <p className="mt-1 text-lg font-semibold">{s?.activeBSPs?.toLocaleString() ?? "—"}</p>
              </div>
            </div>
          </div>
        </section>

        {isError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">
            Could not load dashboard metrics.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label} className="border-border/70 bg-card/95 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-muted-foreground">{c.label}</p>
                      {isLoading ? (
                        <Skeleton className="mt-2 h-8 w-20" />
                      ) : (
                        <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{c.value ?? "—"}</p>
                      )}
                    </div>
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Icon className="size-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-border/70 bg-card/95 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Workspace Directory</CardTitle>
                <CardDescription>Most recent workspaces.</CardDescription>
              </div>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/workspaces">View all <ArrowRight className="size-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/70">
                {workspaces.slice(0, 6).map((w) => (
                  <div key={w._id} className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`size-2.5 shrink-0 rounded-full ${w.whatsappConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.65)]"}`} />
                      <div>
                        <Link href={`/workspaces/${w._id}`} className="text-sm font-semibold hover:text-primary hover:underline">{w.name}</Link>
                        <p className="truncate text-xs text-muted-foreground">{w.owner?.email || "—"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 rounded-lg">{w.plan?.name || "Free Tier"}</Badge>
                  </div>
                ))}
                {!workspaces.length && <p className="p-6 text-center text-sm text-muted-foreground">No workspaces.</p>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary" /> Service Pulse</CardTitle>
                <Badge variant={allUp ? "success" : "outline"} className="rounded-lg">{allUp ? "Nominal" : "Degraded"}</Badge>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {services.length ? services.slice(0, 6).map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="truncate font-medium">{svc.name}</span>
                    <span className={`text-xs font-medium ${svc.status === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                      {svc.status === "up" ? "Operational" : "Down"}
                    </span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No service data.</p>}
                <Button size="sm" variant="ghost" className="mt-2 w-full" asChild>
                  <Link href="/monitoring">Diagnostics <ArrowRight className="size-4" /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader><CardTitle className="text-base">Plan Distribution</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {planDist.length ? planDist.map(([name, count]) => {
                  const pct = workspaces.length ? Math.round((count / workspaces.length) * 100) : 0;
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{name}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.35)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                }) : <p className="text-sm text-muted-foreground">No plan data.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
