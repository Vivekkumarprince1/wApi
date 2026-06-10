"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api/client";

interface WaRequest {
  _id: string;
  workspaceName?: string;
  owner?: { name?: string; email?: string };
  businessId?: string;
  phoneNumber?: string;
  status?: string;
  onboardingStatus?: string;
  accountBlocked?: boolean;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string | null;
}

interface WaResponse {
  items: WaRequest[];
  page: number;
  total: number;
  totalPages: number;
}

export default function WhatsAppRequestsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["whatsapp-requests", page],
    queryFn: () => apiGet<WaResponse>(`/api/admin/read/whatsapp-requests?page=${page}`),
  });

  return (
    <>
      <PageHeader
        title="WhatsApp Requests"
        description="Embedded-signup (ESB) onboarding flows across all workspaces"
      />
      <div className="p-6 space-y-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>WABA / Business ID</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ESB Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive py-8">
                    Failed to load WhatsApp requests.
                  </TableCell>
                </TableRow>
              ) : data && data.items.length > 0 ? (
                data.items.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="font-medium">{r.workspaceName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.owner?.email || r.owner?.name || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.businessId}</TableCell>
                    <TableCell>{r.phoneNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        {r.accountBlocked ? <StatusBadge status="blocked" /> : null}
                      </div>
                      {r.failureReason ? (
                        <p className="text-xs text-destructive mt-1">{r.failureReason}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.startedAt ? new Date(r.startedAt).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No onboarding requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{data.total.toLocaleString()} requests</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
