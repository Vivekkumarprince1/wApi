"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, ShieldAlert, AlertTriangle, ShieldCheck, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

interface AuditRow {
  _id: string;
  action?: string;
  actorEmail?: string;
  adminEmail?: string;
  target?: string;
  targetId?: string;
  workspaceId?: string;
  outcome?: string;
  ip?: string;
  createdAt?: string;
  startedAt?: string;
}

interface AuditResponse {
  type: string;
  items: AuditRow[];
  page: number;
  total: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const [type, setType] = useState<"audit" | "impersonation">("audit");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs", type, page],
    queryFn: () => apiGet<AuditResponse>(`/api/admin/read/audit-logs?type=${type}&page=${page}`),
  });

  const allItems = data?.items ?? [];
  const items = search
    ? allItems.filter((r) =>
        [r.action, r.actorEmail, r.adminEmail, r.target, r.workspaceId, r.ip]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : allItems;

  const securityEvents = allItems.filter((r) => /AUTH|PERM|impersonat|login|role|status|delete|freeze/i.test(r.action || "")).length;
  const failures = allItems.filter((r) => r.outcome === "failure").length;

  const stats = [
    { label: "Entries (page)", value: allItems.length, icon: History, tone: "emerald" },
    { label: "Security Events", value: securityEvents, icon: ShieldAlert, tone: "amber" },
    { label: "Failures", value: failures, icon: AlertTriangle, tone: "rose" },
    { label: "Source", value: type === "audit" ? "Admin" : "Impersonation", icon: ShieldCheck, tone: "slate" },
  ] as const;
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
    slate: "bg-slate-500/10 text-slate-600",
  };

  return (
    <>
      <PageHeader title="Audit Logs" description="Admin activity and impersonation trail" />
      <div className="p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-semibold mt-1">{s.value}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass[s.tone]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex gap-2">
            <Button size="sm" variant={type === "audit" ? "default" : "outline"} onClick={() => { setType("audit"); setPage(1); }}>
              Admin actions
            </Button>
            <Button size="sm" variant={type === "impersonation" ? "default" : "outline"} onClick={() => { setType("impersonation"); setPage(1); }}>
              Impersonation
            </Button>
          </div>
          <div className="relative sm:max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter this page…" className="pl-9" />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{type === "impersonation" ? "Workspace" : "Action"}</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive py-8">
                    Failed to load audit logs.
                  </TableCell>
                </TableRow>
              ) : items.length > 0 ? (
                items.map((row) => {
                  const when = row.createdAt || row.startedAt;
                  return (
                    <TableRow key={row._id}>
                      <TableCell className="font-medium">
                        {type === "impersonation" ? row.workspaceId : row.action}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.actorEmail || row.adminEmail || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.target ? `${row.target}${row.targetId ? `:${row.targetId.slice(-6)}` : ""}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.outcome === "failure" ? "destructive" : "success"}>
                          {row.outcome || "success"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.ip || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {when ? new Date(when).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No entries.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
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
        )}
      </div>
    </>
  );
}
