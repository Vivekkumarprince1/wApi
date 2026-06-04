"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, AlertTriangle, Megaphone, Lock, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiGet, apiFetch, apiPost } from "@/lib/api/client";
import { useAdminAuth } from "@/store/admin-auth-store";

interface SystemNotice {
  message?: string;
  level?: string;
  active?: boolean;
}
interface SettingsData {
  data: {
    appName?: string;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    allowNewSignups?: boolean;
    systemNotice?: SystemNotice | string | null;
    features?: { emergencyLockdown?: { active?: boolean; reason?: string } };
  };
}

export default function SettingsPage() {
  const can = useAdminAuth((s) => s.can);
  const editable = can("system");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SettingsData>("/api/admin/read/settings"),
  });

  const [form, setForm] = useState({ maintenanceMode: false, maintenanceMessage: "", allowNewSignups: true });
  const [broadcast, setBroadcast] = useState<{ title: string; message: string; level: string }>({
    title: "",
    message: "",
    level: "info",
  });
  const lockdownActive = !!data?.data?.features?.emergencyLockdown?.active;

  useEffect(() => {
    if (data?.data) {
      setForm({
        maintenanceMode: !!data.data.maintenanceMode,
        maintenanceMessage: data.data.maintenanceMessage || "",
        allowNewSignups: data.data.allowNewSignups !== false,
      });
      const n = data.data.systemNotice;
      if (n && typeof n === "object") {
        setBroadcast({ title: "", message: n.message || "", level: n.level || "info" });
      }
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch("/api/admin/ops/settings", { method: "PATCH", body: form }),
    onSuccess: () => { toast.success("Settings saved"); refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendBroadcast = useMutation({
    mutationFn: () =>
      apiPost("/api/admin/ops/actions", {
        action: "broadcast",
        payload: { message: broadcast.message, level: broadcast.level, active: true },
      }),
    onSuccess: () => { toast.success("Broadcast published"); refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearBroadcast = useMutation({
    mutationFn: () => apiPost("/api/admin/ops/actions", { action: "broadcast", payload: { message: "", active: false } }),
    onSuccess: () => { toast.success("Broadcast cleared"); refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const lockdown = useMutation({
    mutationFn: (enabled: boolean) => {
      const reason = enabled ? window.prompt("Reason for emergency lockdown:") || "Emergency admin action" : "";
      return apiPost("/api/admin/ops/actions", { action: "emergency-freeze", payload: { enabled, reason } });
    },
    onSuccess: () => { toast.success("Lockdown state updated"); refetch(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearCache = useMutation({
    mutationFn: () => apiPost("/api/admin/ops/actions", { action: "clear-cache" }),
    onSuccess: (res: unknown) => {
      const cleared = (res as { data?: { cleared?: boolean } })?.data?.cleared;
      toast.success(cleared ? "Cache flushed" : "Cache flush attempted (Redis may be unavailable)");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Global platform configuration"
        actions={
          editable ? (
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              <Save className="h-4 w-4" /> Save
            </Button>
          ) : null
        }
      />
      <div className="p-6 space-y-6 max-w-4xl">
        {isError ? (
          <p className="text-sm text-destructive">Failed to load settings.</p>
        ) : isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Maintenance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" /> Maintenance mode</CardTitle>
                <CardDescription>Blocks non-super-admin users when enabled.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maint">Enable maintenance mode</Label>
                  <Switch id="maint" checked={form.maintenanceMode} disabled={!editable} onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, maintenanceMode: v }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="msg">Maintenance message</Label>
                  <Input id="msg" value={form.maintenanceMessage} disabled={!editable} onChange={(e) => setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))} placeholder="We'll be back shortly…" />
                </div>
              </CardContent>
            </Card>

            {/* Signups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signups</CardTitle>
                <CardDescription>Control whether new accounts can be created.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="signups">Allow new signups</Label>
                  <Switch id="signups" checked={form.allowNewSignups} disabled={!editable} onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, allowNewSignups: v }))} />
                </div>
              </CardContent>
            </Card>

            {/* Global broadcast */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-primary" /> Global broadcast</CardTitle>
                <CardDescription>Publishes a platform-wide system notice shown to all users.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {["info", "warning", "critical"].map((lvl) => (
                    <button
                      key={lvl}
                      disabled={!editable}
                      onClick={() => setBroadcast((b) => ({ ...b, level: lvl }))}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border capitalize transition-colors",
                        broadcast.level === lvl ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={broadcast.message}
                  disabled={!editable}
                  onChange={(e) => setBroadcast((b) => ({ ...b, message: e.target.value }))}
                  placeholder="Message shown to all users…"
                  className="min-h-20"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={!editable || sendBroadcast.isPending || !broadcast.message.trim()} onClick={() => sendBroadcast.mutate()}>
                    {sendBroadcast.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Publish broadcast
                  </Button>
                  <Button size="sm" variant="outline" disabled={!editable || clearBroadcast.isPending} onClick={() => clearBroadcast.mutate()}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Emergency lockdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4 text-rose-500" /> Emergency lockdown</CardTitle>
                <CardDescription>Platform-wide lockdown flag for incident response.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={lockdownActive ? "destructive" : "outline"}>{lockdownActive ? "Active" : "Inactive"}</Badge>
                  {data?.data?.features?.emergencyLockdown?.reason ? (
                    <span className="text-xs text-muted-foreground">{data.data.features.emergencyLockdown.reason}</span>
                  ) : null}
                </div>
                <Switch checked={lockdownActive} disabled={!editable || lockdown.isPending} onCheckedChange={(v: boolean) => lockdown.mutate(v)} />
              </CardContent>
            </Card>

            {/* Cache control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> System cache</CardTitle>
                <CardDescription>Flush the platform Redis cache.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" disabled={!editable || clearCache.isPending} onClick={() => { if (confirm("Flush the platform Redis cache?")) clearCache.mutate(); }}>
                  {clearCache.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Flush Redis cache
                </Button>
              </CardContent>
            </Card>

            {!editable && <p className="text-xs text-muted-foreground md:col-span-2">Your role can view settings but not change them.</p>}
          </div>
        )}
      </div>
    </>
  );
}
