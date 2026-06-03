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
      <PageHeader title="Dashboard" description="Platform overview" />
      <div className="p-6 space-y-6">
        {isError ? (
          <p className="text-sm text-destructive">Could not load dashboard metrics.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label}>
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="text-sm text-muted-foreground">{c.label}</p>
                      {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-semibold mt-1">{c.value ?? "—"}</p>}
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Workspace directory */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Workspace Directory</CardTitle>
                <CardDescription>Most recent workspaces.</CardDescription>
              </div>
              <Link href="/workspaces"><Button size="sm" variant="ghost">View all <ArrowRight className="h-4 w-4" /></Button></Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {workspaces.slice(0, 6).map((w) => (
                  <div key={w._id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${w.whatsappConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <div>
                        <Link href={`/workspaces/${w._id}`} className="text-sm font-medium hover:text-primary hover:underline">{w.name}</Link>
                        <p className="text-xs text-muted-foreground">{w.owner?.email || "—"}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{w.plan?.name || "Free Tier"}</Badge>
                  </div>
                ))}
                {!workspaces.length && <p className="p-6 text-center text-sm text-muted-foreground">No workspaces.</p>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Service pulse */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Service Pulse</CardTitle>
                <Badge variant={allUp ? "success" : "outline"}>{allUp ? "Nominal" : "Degraded"}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {services.length ? services.slice(0, 6).map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between text-sm">
                    <span>{svc.name}</span>
                    <span className={`text-xs font-medium ${svc.status === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                      {svc.status === "up" ? "Operational" : "Down"}
                    </span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No service data.</p>}
                <Link href="/monitoring"><Button size="sm" variant="ghost" className="w-full mt-2">Diagnostics <ArrowRight className="h-4 w-4" /></Button></Link>
              </CardContent>
            </Card>

            {/* Plan distribution */}
            <Card>
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
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
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
