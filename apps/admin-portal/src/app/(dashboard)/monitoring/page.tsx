"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Server, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api/client";

interface MonitoringData {
  services: { id: string; name: string; tier?: string; status: "up" | "down"; latencyMs: number | null }[];
  databases: { name: string; status: string }[];
  process: { uptimeSec: number; memoryRssMb: number; nodeVersion: string; mongooseVersion: string };
  generatedAt: string;
}

function uptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

export default function MonitoringPage() {
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["monitoring"],
    queryFn: () => apiGet<MonitoringData>("/api/admin/read/monitoring"),
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Live service health, databases, and process metrics"
        actions={
          isFetching ? (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null
        }
      />
      <div className="p-6 space-y-6">
        {isError ? (
          <p className="text-sm text-destructive">Failed to load monitoring data.</p>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Server className="h-4 w-4" /> Services
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <Skeleton className="h-5 w-32" />
                        </CardContent>
                      </Card>
                    ))
                  : data?.services.map((s) => (
                      <Card key={s.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.tier ? `${s.tier} · ` : ""}{s.latencyMs != null ? `${s.latencyMs} ms` : "—"}
                            </p>
                          </div>
                          <Badge variant={s.status === "up" ? "success" : "destructive"}>
                            {s.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Database className="h-4 w-4" /> Databases
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <Skeleton className="h-5 w-24" />
                        </CardContent>
                      </Card>
                    ))
                  : data?.databases.map((d) => (
                      <Card key={d.name}>
                        <CardContent className="flex items-center justify-between p-4">
                          <p className="font-medium text-sm capitalize">{d.name}</p>
                          <Badge variant={d.status === "connected" ? "success" : "outline"}>
                            {d.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
              </div>
            </section>

            {data?.process && (
              <section>
                <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Admin Portal Process
                </h2>
                <Card>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 text-sm">
                    <Metric label="Uptime" value={uptime(data.process.uptimeSec)} />
                    <Metric label="Memory (RSS)" value={`${data.process.memoryRssMb} MB`} />
                    <Metric label="Node" value={data.process.nodeVersion} />
                    <Metric label="Mongoose" value={data.process.mongooseVersion} />
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
