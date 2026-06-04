"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api/client";

interface ComplianceData {
  data: {
    businessVerificationMandatory?: boolean;
    provider?: string;
    webhookAuditEnabled?: boolean;
    emergencyFreezeEnabled?: boolean;
  };
}

export default function CompliancePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["compliance"],
    queryFn: () => apiGet<ComplianceData>("/api/admin/read/compliance"),
  });

  const p = data?.data;
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Business verification mandatory",
      value: <Badge variant={p?.businessVerificationMandatory ? "success" : "outline"}>{p?.businessVerificationMandatory ? "Yes" : "No"}</Badge>,
    },
    { label: "Verification provider", value: <Badge variant="outline">{p?.provider || "—"}</Badge> },
    {
      label: "Webhook audit",
      value: <Badge variant={p?.webhookAuditEnabled ? "success" : "outline"}>{p?.webhookAuditEnabled ? "Enabled" : "Disabled"}</Badge>,
    },
    {
      label: "Emergency freeze",
      value: <Badge variant={p?.emergencyFreezeEnabled ? "success" : "outline"}>{p?.emergencyFreezeEnabled ? "Available" : "Unavailable"}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader title="Compliance" description="Verification, audit, and safety controls" />
      <div className="p-6 max-w-2xl">
        {isError ? (
          <p className="text-sm text-destructive">Failed to load compliance profile.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Compliance profile</span>
              </div>
              <div className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="px-5 py-4">
                        <Skeleton className="h-5 w-48" />
                      </div>
                    ))
                  : rows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between px-5 py-4">
                        <span className="text-sm text-muted-foreground">{r.label}</span>
                        {r.value}
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
