"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { Megaphone, Workflow, MessageSquare, RefreshCw, Webhook } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPost } from "@/lib/api/client";
import { useAdminAuth } from "@/store/admin-auth-store";

interface OperationsData {
  campaigns: Record<string, number>;
  automation: { total: number; enabled: number };
  gupshup: { status?: string; [k: string]: unknown };
}

export default function OperationsPage() {
  const can = useAdminAuth((s) => s.can);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["operations"],
    queryFn: () => apiGet<OperationsData>("/api/admin/read/operations"),
    refetchInterval: 30_000,
  });

  const op = useMutation({
    mutationFn: (action: string) => apiPost(`/api/admin/ops/operations/${action}`),
    onSuccess: () => {
      toast.success("Operation triggered");
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const campaignEntries = Object.entries(data?.campaigns || {});

  return (
    <>
      <PageHeader
        title="Operations"
        description="Campaigns, automation, and BSP (Gupshup) operations"
        actions={
          can("operations") ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={op.isPending} onClick={() => op.mutate("gupshup-reconcile")}>
                <RefreshCw className={`h-4 w-4 ${op.isPending ? "animate-spin" : ""}`} /> Reconcile Gupshup
              </Button>
              <Button size="sm" variant="outline" disabled={op.isPending} onClick={() => op.mutate("sync-all-webhooks")}>
                <Webhook className="h-4 w-4" /> Sync Webhooks
              </Button>
            </div>
          ) : null
        }
      />
      <div className="p-6 space-y-6">
        {isError ? (
          <p className="text-sm text-destructive">Failed to load operations data.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">Automation rules</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16 mt-1" />
                    ) : (
                      <p className="text-2xl font-semibold mt-1">
                        {data?.automation.enabled}{" "}
                        <span className="text-sm text-muted-foreground">/ {data?.automation.total} enabled</span>
                      </p>
                    )}
                  </div>
                  <Icon icon={Workflow} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">Gupshup / BSP</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20 mt-1" />
                    ) : (
                      <p className="text-lg font-semibold mt-1 capitalize">
                        {String(data?.gupshup?.status ?? "unknown")}
                      </p>
                    )}
                  </div>
                  <Icon icon={MessageSquare} />
                </CardContent>
              </Card>
            </div>

            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4" /> Campaigns by status
              </h2>
              <div className="flex flex-wrap gap-2">
                {isLoading ? (
                  <Skeleton className="h-7 w-64" />
                ) : campaignEntries.length ? (
                  campaignEntries.map(([status, count]) => (
                    <Badge key={status} variant="outline" className="capitalize">
                      {status}: {count}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No campaigns.</span>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function Icon({ icon: I }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
      <I className="h-5 w-5 text-primary" />
    </div>
  );
}
