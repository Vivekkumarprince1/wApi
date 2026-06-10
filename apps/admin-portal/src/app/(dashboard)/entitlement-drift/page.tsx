"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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

interface DriftEntry {
  workspaceId: string;
  workspaceName?: string;
  planName?: string;
  missingFeatures: string[];
  extraFeatures: string[];
  driftScore: number;
}

interface DriftResponse {
  data: DriftEntry[];
  summary: { scanned: number; drifted: number };
}

export default function EntitlementDriftPage() {
  const qc = useQueryClient();
  const can = useAdminAuth((s) => s.can);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["entitlement-drift"],
    queryFn: () => apiGet<DriftResponse>("/api/admin/read/entitlement-drift"),
  });

  const repair = useMutation({
    mutationFn: (workspaceId?: string) =>
      apiPost<{ message: string }>("/api/admin/ops/repair", workspaceId ? { workspaceId } : {}),
    onSuccess: (res) => {
      toast.success(res.message || "Repair complete");
      qc.invalidateQueries({ queryKey: ["entitlement-drift"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Entitlement Drift"
        description="Workspaces whose effective features diverge from their plan catalogue"
        actions={
          can("system") ? (
            <Button size="sm" disabled={repair.isPending} onClick={() => repair.mutate(undefined)}>
              {repair.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4" />
              )}
              Repair all
            </Button>
          ) : null
        }
      />
      <div className="p-6 space-y-4">
        {data?.summary && (
          <div className="grid gap-4 sm:grid-cols-2 max-w-md">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Workspaces scanned</p>
                <p className="text-2xl font-semibold mt-1">{data.summary.scanned}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Drifted</p>
                <p className="text-2xl font-semibold mt-1">{data.summary.drifted}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Missing features</TableHead>
                <TableHead>Extra features</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-destructive py-8">
                    Failed to compute entitlement drift.
                  </TableCell>
                </TableRow>
              ) : data && data.data.length > 0 ? (
                data.data.map((d) => (
                  <TableRow key={d.workspaceId}>
                    <TableCell className="font-medium">{d.workspaceName}</TableCell>
                    <TableCell className="text-muted-foreground">{d.planName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {d.missingFeatures.length
                          ? d.missingFeatures.map((f) => (
                              <Badge key={f} variant="destructive">
                                {f}
                              </Badge>
                            ))
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {d.extraFeatures.length
                          ? d.extraFeatures.map((f) => (
                              <Badge key={f} variant="secondary">
                                {f}
                              </Badge>
                            ))
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {can("system") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={repair.isPending}
                          onClick={() => repair.mutate(d.workspaceId)}
                        >
                          <Wrench className="h-4 w-4" /> Repair
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No entitlement drift detected. All workspaces match their plan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
