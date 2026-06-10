"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, DollarSign, Users, Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api/client";

interface AnalyticsData {
  revenue: { mrrCents: number; arrCents: number; arpaCents: number; currency: string };
  subscriptions: Record<string, number>;
  rates: { churnRate: number; activationRate: number };
  growth: { totalWorkspaces: number; newWorkspaces30d: number };
  notes: { cac: string; ltv: string };
}

function inr(minor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format((minor || 0) / 100);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiGet<AnalyticsData>("/api/admin/read/analytics"),
  });

  // LTV ≈ ARPA / churnRate (guard against div-by-zero).
  const ltvCents =
    data && data.rates.churnRate > 0 ? Math.round(data.revenue.arpaCents / data.rates.churnRate) : null;

  const metrics = [
    { label: "MRR", value: data ? inr(data.revenue.mrrCents) : undefined, icon: DollarSign },
    { label: "ARR", value: data ? inr(data.revenue.arrCents) : undefined, icon: TrendingUp },
    { label: "ARPA", value: data ? inr(data.revenue.arpaCents) : undefined, icon: DollarSign },
    { label: "LTV (est.)", value: ltvCents != null ? inr(ltvCents) : "—", icon: TrendingUp },
    { label: "Churn rate", value: data ? pct(data.rates.churnRate) : undefined, icon: Activity },
    { label: "Activation rate", value: data ? pct(data.rates.activationRate) : undefined, icon: Activity },
    { label: "Workspaces", value: data ? data.growth.totalWorkspaces.toLocaleString() : undefined, icon: Users },
    { label: "New (30d)", value: data ? data.growth.newWorkspaces30d.toLocaleString() : undefined, icon: Users },
  ];

  return (
    <>
      <PageHeader title="Analytics" description="Revenue, growth, retention" />
      <div className="p-6 space-y-6">
        {isError ? (
          <p className="text-sm text-destructive">Failed to load analytics.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((m) => {
                const I = m.icon;
                return (
                  <Card key={m.label}>
                    <CardContent className="flex items-center justify-between p-5">
                      <div>
                        <p className="text-sm text-muted-foreground">{m.label}</p>
                        {isLoading ? (
                          <Skeleton className="h-7 w-20 mt-1" />
                        ) : (
                          <p className="text-xl font-semibold mt-1">{m.value ?? "—"}</p>
                        )}
                      </div>
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <I className="h-4 w-4 text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {data?.notes && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>CAC: {data.notes.cac}</p>
                <p>LTV: {data.notes.ltv}</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
