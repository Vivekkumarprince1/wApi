"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { CreateMetaAdModal } from "@/components/ads/CreateMetaAdModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAds, getMetaAdsReadiness, syncAd, syncAllAds, updateAdStatus } from "@/lib/api/ads";
import { getMetaAdsStatus } from "@/lib/api/integrations";
import { cn } from "@/lib/utils";

type MetaAd = {
  _id: string;
  name: string;
  status: "draft" | "pending_review" | "active" | "paused" | "rejected" | "completed" | "error";
  metaStatus?: string;
  metaCampaignId?: string;
  metaAdSetId?: string;
  metaAdCreativeId?: string;
  metaAdId?: string;
  metaObjective?: string;
  budget?: number;
  budgetType?: "DAILY" | "LIFETIME";
  currency?: string;
  productCatalogId?: string;
  productCatalogName?: string;
  productSetId?: string;
  productSetName?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  targeting?: {
    countries?: string[];
    ageMin?: number;
    ageMax?: number;
    genders?: string[];
    publisherPlatforms?: string[];
  };
  spentAmount?: number;
  impressions?: number;
  reach?: number;
  frequency?: number;
  clicks?: number;
  inlineLinkClicks?: number;
  conversions?: number;
  results?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  costPerResult?: number;
  qualityRanking?: string;
  engagementRateRanking?: string;
  conversionRateRanking?: string;
  lastSyncedAt?: string;
  lastMetaSyncError?: string;
  metaApiLogs?: Array<{
    timestamp?: string;
    action?: string;
    error?: string;
    metaRequestId?: string;
  }>;
};

type StatusFilter = "all" | MetaAd["status"];

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Review", value: "pending_review" },
  { label: "Paused", value: "paused" },
  { label: "Draft", value: "draft" },
  { label: "Error", value: "error" },
];

function formatNumber(value?: number) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function formatCurrency(value?: number, currency = "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercent(value?: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusBadge(status: MetaAd["status"], metaStatus?: string) {
  const label = metaStatus || status.replace(/_/g, " ");
  if (status === "active") return <Badge variant="success">{label}</Badge>;
  if (status === "error" || status === "rejected") return <Badge variant="destructive">{label}</Badge>;
  if (status === "pending_review") return <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-700">{label}</Badge>;
  if (status === "paused") return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

function compactObjective(value?: string) {
  return String(value || "OUTCOME_ENGAGEMENT").replace("OUTCOME_", "").toLowerCase();
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export default function AdsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyAdId, setBusyAdId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAd, setSelectedAd] = useState<MetaAd | null>(null);

  const { data: ads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["ads"],
    queryFn: getAds,
  });
  const { data: metaStatus } = useQuery({
    queryKey: ["meta-ads-readiness"],
    queryFn: async () => {
      try {
        return await getMetaAdsReadiness();
      } catch {
        return getMetaAdsStatus();
      }
    },
  });

  const rows = ads as MetaAd[];
  const selectedMetaAssets = metaStatus?.selected || metaStatus?.integration?.configMetadata?.selected || {};
  const metaReady = Boolean(
    metaStatus?.connected &&
    (metaStatus?.configured || (selectedMetaAssets.adAccountId && selectedMetaAssets.pageId))
  );
  const currency = rows[0]?.currency || "INR";

  const filteredAds = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((ad) => {
      const matchesStatus = statusFilter === "all" || ad.status === statusFilter;
      const matchesSearch = !search || [ad.name, ad.headline, ad.metaAdId, ad.metaCampaignId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [rows, query, statusFilter]);

  const totals = useMemo(() => rows.reduce((acc, ad) => ({
    spend: acc.spend + Number(ad.spentAmount || 0),
    clicks: acc.clicks + Number(ad.clicks || 0),
    impressions: acc.impressions + Number(ad.impressions || 0),
    results: acc.results + Number(ad.results || ad.conversions || 0),
    active: acc.active + (ad.status === "active" ? 1 : 0),
    errors: acc.errors + (ad.status === "error" || ad.status === "rejected" ? 1 : 0),
  }), { spend: 0, clicks: 0, impressions: 0, results: 0, active: 0, errors: 0 }), [rows]);

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

  const refreshAds = () => queryClient.invalidateQueries({ queryKey: ["ads"] });

  const openCreateOrConnect = () => {
    if (metaReady) {
      setCreateOpen(true);
      return;
    }
    router.push("/integrations");
  };

  const handleMetaStatus = async (ad: MetaAd, status: "ACTIVE" | "PAUSED") => {
    setBusyAdId(ad._id);
    const toastId = toast.loading(status === "ACTIVE" ? "Activating Meta ad..." : "Pausing Meta ad...");
    try {
      await updateAdStatus(ad._id, status);
      toast.success(status === "ACTIVE" ? "Ad activated" : "Ad paused", { id: toastId });
      refreshAds();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Meta status update failed", { id: toastId });
    } finally {
      setBusyAdId(null);
    }
  };

  const handleSync = async (ad: MetaAd) => {
    setBusyAdId(ad._id);
    const toastId = toast.loading("Syncing Meta metrics...");
    try {
      const updated = await syncAd(ad._id);
      toast.success("Ad metrics synced", { id: toastId });
      setSelectedAd((current) => current?._id === ad._id ? updated : current);
      refreshAds();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Meta sync failed", { id: toastId });
    } finally {
      setBusyAdId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    const toastId = toast.loading("Syncing all Meta ads...");
    try {
      const result = await syncAllAds();
      toast.success(`Synced ${result?.synced || 0} ads${result?.failed ? `, ${result.failed} failed` : ""}`, { id: toastId });
      refreshAds();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Bulk sync failed", { id: toastId });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 p-4 pb-20 sm:p-6 lg:p-8">
      <CreateMetaAdModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refreshAds}
        metaSelection={{
          productCatalogId: selectedMetaAssets.productCatalogId,
          productCatalogName: selectedMetaAssets.productCatalogName || metaStatus?.metadata?.assets?.productCatalogName,
          productSetId: selectedMetaAssets.productSetId,
          productSetName: selectedMetaAssets.productSetName || metaStatus?.metadata?.assets?.productSetName,
          currency: selectedMetaAssets.currency,
        }}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg border bg-muted">
              <Megaphone className="size-4" />
            </div>
            <Badge variant="outline">Click-to-WhatsApp</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Ads</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Launch, pause, and monitor Meta ads that send customers into WhatsApp conversations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/integrations")}>
            <Settings className="size-4" />
            Meta assets
          </Button>
          <Button variant="outline" onClick={handleSyncAll} disabled={!rows.some((ad) => ad.metaAdId) || syncingAll}>
            {syncingAll ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Sync all
          </Button>
          <Button onClick={openCreateOrConnect}>
            <Plus className="size-4" />
            {metaReady ? "Create ad" : "Connect Meta"}
          </Button>
        </div>
      </div>

      <section
        className={cn(
          "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
          metaReady ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5"
        )}
      >
        <div className="flex gap-3">
          {metaReady ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 size-5 text-amber-700" />}
          <div>
            <p className="text-sm font-medium">{metaReady ? "Meta Ads is ready" : "Meta Ads needs setup"}</p>
            <p className="text-sm text-muted-foreground">
              {metaReady
                ? `Configured account ${selectedMetaAssets.adAccountId || "selected customer ad account"}${selectedMetaAssets.productCatalogId ? ` with catalog ${selectedMetaAssets.productCatalogName || selectedMetaAssets.productCatalogId}` : ""}.`
                : "Connect Meta Ads and select an ad account, page, and WhatsApp number before launching."}
            </p>
          </div>
        </div>
        {!metaReady && (
          <Button variant="outline" size="sm" onClick={() => router.push("/integrations")}>
            Configure
            <ArrowUpRight className="size-3.5" />
          </Button>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-lg p-4">
          <StatCell label="Spend" value={formatCurrency(totals.spend, currency)} />
        </Card>
        <Card className="rounded-lg p-4">
          <StatCell label="Results" value={formatNumber(totals.results)} />
        </Card>
        <Card className="rounded-lg p-4">
          <StatCell label="CTR" value={formatPercent(avgCtr)} />
        </Card>
        <Card className="rounded-lg p-4">
          <StatCell label="Avg. CPC" value={formatCurrency(avgCpc, currency)} />
        </Card>
        <Card className="rounded-lg p-4">
          <StatCell label="Active / issues" value={`${totals.active} / ${totals.errors}`} />
        </Card>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search ads"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search campaigns, headlines, or Meta IDs"
              className="pl-8"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={statusFilter === option.value ? "secondary" : "ghost"}
                onClick={() => setStatusFilter(option.value)}
                className="shrink-0"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <div>
              <h2 className="text-base font-medium">Could not load ads</h2>
              <p className="text-sm text-muted-foreground">Refresh the list after checking the campaign service.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
            <Megaphone className="size-8 text-muted-foreground" />
            <div>
              <h2 className="text-base font-medium">{rows.length ? "No ads match this view" : "No ads yet"}</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {rows.length ? "Adjust your search or status filter." : "Create a Click-to-WhatsApp ad once Meta assets are connected."}
              </p>
            </div>
            <Button onClick={openCreateOrConnect}>{metaReady ? "Create ad" : "Connect Meta"}</Button>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Ad</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Spend</TableHead>
                    <TableHead>Results</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>CPC</TableHead>
                    <TableHead>Last sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAds.map((ad) => (
                    <TableRow key={ad._id} className="cursor-pointer" onClick={() => setSelectedAd(ad)}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{ad.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {compactObjective(ad.metaObjective)} · {ad.metaAdId || "not published"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(ad.status, ad.metaStatus)}</TableCell>
                      <TableCell>{formatCurrency(ad.budget, ad.currency || currency)} <span className="text-xs text-muted-foreground">{ad.budgetType === "LIFETIME" ? "life" : "day"}</span></TableCell>
                      <TableCell>{formatCurrency(ad.spentAmount, ad.currency || currency)}</TableCell>
                      <TableCell>{formatNumber(ad.results || ad.conversions)}</TableCell>
                      <TableCell>{formatPercent(ad.ctr)}</TableCell>
                      <TableCell>{formatCurrency(ad.cpc, ad.currency || currency)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ad.lastSyncedAt ? formatDate(ad.lastSyncedAt) : "Never"}</TableCell>
                      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                        <RowActions ad={ad} busyAdId={busyAdId} onOpen={setSelectedAd} onSync={handleSync} onStatus={handleMetaStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {filteredAds.map((ad) => (
                <button
                  key={ad._id}
                  type="button"
                  onClick={() => setSelectedAd(ad)}
                  className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ad.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{ad.metaAdId || "Not published"}</p>
                    </div>
                    {getStatusBadge(ad.status, ad.metaStatus)}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <StatCell label="Spend" value={formatCurrency(ad.spentAmount, ad.currency || currency)} />
                    <StatCell label="Results" value={formatNumber(ad.results || ad.conversions)} />
                    <StatCell label="CTR" value={formatPercent(ad.ctr)} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <AdDetailSheet
        ad={selectedAd}
        currency={currency}
        busyAdId={busyAdId}
        onOpenChange={(open) => !open && setSelectedAd(null)}
        onSync={handleSync}
        onStatus={handleMetaStatus}
      />
    </main>
  );
}

function RowActions({
  ad,
  busyAdId,
  onOpen,
  onSync,
  onStatus,
}: {
  ad: MetaAd;
  busyAdId: string | null;
  onOpen: (ad: MetaAd) => void;
  onSync: (ad: MetaAd) => void;
  onStatus: (ad: MetaAd, status: "ACTIVE" | "PAUSED") => void;
}) {
  const busy = busyAdId === ad._id;
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="Sync ad" onClick={() => onSync(ad)} disabled={!ad.metaAdId || busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Ad actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onOpen(ad)}>
            <Eye className="size-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (!ad.metaAdId || busy) return;
              onStatus(ad, ad.status === "active" ? "PAUSED" : "ACTIVE");
            }}
            data-disabled={!ad.metaAdId || busy}
          >
            {ad.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
            {ad.status === "active" ? "Pause" : "Activate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AdDetailSheet({
  ad,
  currency,
  busyAdId,
  onOpenChange,
  onSync,
  onStatus,
}: {
  ad: MetaAd | null;
  currency: string;
  busyAdId: string | null;
  onOpenChange: (open: boolean) => void;
  onSync: (ad: MetaAd) => void;
  onStatus: (ad: MetaAd, status: "ACTIVE" | "PAUSED") => void;
}) {
  const busy = Boolean(ad && busyAdId === ad._id);
  const latestLog = ad?.metaApiLogs?.[ad.metaApiLogs.length - 1];

  return (
    <Sheet open={Boolean(ad)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {ad && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <SheetTitle className="truncate">{ad.name}</SheetTitle>
                  <SheetDescription className="truncate">{ad.metaAdId || "Local draft"}</SheetDescription>
                </div>
                {getStatusBadge(ad.status, ad.metaStatus)}
              </div>
            </SheetHeader>

            <div className="grid gap-4 p-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => onSync(ad)} disabled={!ad.metaAdId || busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                  Sync
                </Button>
                <Button variant="outline" onClick={() => onStatus(ad, ad.status === "active" ? "PAUSED" : "ACTIVE")} disabled={!ad.metaAdId || busy}>
                  {ad.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {ad.status === "active" ? "Pause" : "Activate"}
                </Button>
              </div>

              <section className="grid grid-cols-2 gap-3">
                <Card className="rounded-lg p-3"><StatCell label="Spend" value={formatCurrency(ad.spentAmount, ad.currency || currency)} /></Card>
                <Card className="rounded-lg p-3"><StatCell label="Results" value={formatNumber(ad.results || ad.conversions)} /></Card>
                <Card className="rounded-lg p-3"><StatCell label="Reach" value={formatNumber(ad.reach)} /></Card>
                <Card className="rounded-lg p-3"><StatCell label="Frequency" value={Number(ad.frequency || 0).toFixed(2)} /></Card>
                <Card className="rounded-lg p-3"><StatCell label="CPM" value={formatCurrency(ad.cpm, ad.currency || currency)} /></Card>
                <Card className="rounded-lg p-3"><StatCell label="Cost/result" value={formatCurrency(ad.costPerResult, ad.currency || currency)} /></Card>
              </section>

              <section className="rounded-lg border">
                <div className="border-b px-3 py-2">
                  <h3 className="text-sm font-medium">Creative</h3>
                </div>
                <dl className="grid gap-3 p-3 text-sm">
                  <DetailRow label="Headline" value={ad.headline || "Not set"} />
                  <DetailRow label="Primary text" value={ad.primaryText || "Not set"} />
                  <DetailRow label="Description" value={ad.description || "Not set"} />
                  <DetailRow label="Commerce catalog" value={ad.productCatalogName || ad.productCatalogId || "Not attached"} />
                  <DetailRow label="Product set" value={ad.productSetName || ad.productSetId || "All products"} />
                  <DetailRow label="Schedule" value={`${formatDate(ad.scheduleStart)} - ${ad.scheduleEnd ? formatDate(ad.scheduleEnd) : "ongoing"}`} />
                </dl>
              </section>

              <section className="rounded-lg border">
                <div className="border-b px-3 py-2">
                  <h3 className="text-sm font-medium">Targeting and Meta objects</h3>
                </div>
                <dl className="grid gap-3 p-3 text-sm">
                  <DetailRow label="Audience" value={`${ad.targeting?.countries?.join(", ") || "IN"} · ${ad.targeting?.ageMin || 18}-${ad.targeting?.ageMax || 65}`} />
                  <DetailRow label="Campaign" value={ad.metaCampaignId || "Not published"} mono />
                  <DetailRow label="Ad set" value={ad.metaAdSetId || "Not published"} mono />
                  <DetailRow label="Creative" value={ad.metaAdCreativeId || "Not published"} mono />
                  <DetailRow label="Ad" value={ad.metaAdId || "Not published"} mono />
                </dl>
              </section>

              <section className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <h3 className="text-sm font-medium">Delivery quality</h3>
                  <BarChart3 className="size-4 text-muted-foreground" />
                </div>
                <dl className="grid gap-3 p-3 text-sm">
                  <DetailRow label="Quality ranking" value={ad.qualityRanking || "Unavailable"} />
                  <DetailRow label="Engagement ranking" value={ad.engagementRateRanking || "Unavailable"} />
                  <DetailRow label="Conversion ranking" value={ad.conversionRateRanking || "Unavailable"} />
                </dl>
              </section>

              <section className="rounded-lg border">
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Clock3 className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Latest Meta log</h3>
                </div>
                <div className="grid gap-2 p-3 text-sm">
                  <p className="text-muted-foreground">{latestLog?.timestamp ? formatDate(latestLog.timestamp) : "No sync log yet"}</p>
                  <p className="font-medium">{latestLog?.action || "Waiting for Meta activity"}</p>
                  {(latestLog?.error || ad.lastMetaSyncError) && (
                    <p className="rounded-md bg-destructive/10 p-2 text-destructive">{latestLog?.error || ad.lastMetaSyncError}</p>
                  )}
                  {latestLog?.metaRequestId && <p className="truncate font-mono text-xs text-muted-foreground">Request {latestLog.metaRequestId}</p>}
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words text-foreground", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
