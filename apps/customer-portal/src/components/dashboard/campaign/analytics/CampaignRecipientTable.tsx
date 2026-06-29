"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  Clock,
  CheckCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

import { fetchCampaignMessages, getCampaignExportUrl } from "@/lib/api/campaigns";

interface CampaignRecipientTableProps {
  campaignId: string;
  externalStatus?: string;
  onStatusChange?: (status: string) => void;
}

export function CampaignRecipientTable({ campaignId, externalStatus, onStatusChange }: CampaignRecipientTableProps) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Sync with external status if provided
  useEffect(() => {
    if (externalStatus && externalStatus !== status) {
      setStatus(externalStatus);
      setPage(1);
    }
  }, [externalStatus, status]);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
    if (onStatusChange) onStatusChange(newStatus);
  };

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['campaign-messages', campaignId, page, status, search],
    queryFn: async () => {
      const response: any = await fetchCampaignMessages(campaignId, { page, limit: 10, status, search });
      return response; // internal api returns response.data
    },
    refetchInterval: 10000 // Poll every 10s
  });

  const payload = (data as any)?.data || data || {};
  const messages = payload?.messages || [];
  const pagination = payload?.pagination || { total: 0, pages: 1 };

  const getContactName = (msg: any) =>
    msg.contact?.displayName ||
    msg.contact?.name ||
    msg.contact?.whatsappName ||
    msg.contact?.phone ||
    msg.phone ||
    'Unknown recipient';

  const getContactPhone = (msg: any) => msg.phone || msg.contact?.phone || 'Phone unavailable';

  const formatDateTime = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityRows = (msg: any) => [
    { label: 'Queued', value: formatDateTime(msg.queuedAt || msg.createdAt) },
    { label: 'Sent', value: formatDateTime(msg.sentAt) },
    { label: 'Delivered', value: formatDateTime(msg.deliveredAt) },
    { label: 'Read', value: formatDateTime(msg.readAt) },
    { label: 'Failed', value: formatDateTime(msg.failedAt) },
  ].filter((row) => row.value);

  const getStatusBadge = (s: string) => {
    const normalizedStatus = (s || '').toLowerCase();
    const config: any = {
      'sent': { color: 'bg-blue-500/10 text-blue-600 border-blue-200', pulse: false },
      'delivered': { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', pulse: false },
      'read': { color: 'bg-indigo-500/10 text-indigo-500 border-indigo-200', pulse: false },
      'failed': { color: 'bg-destructive/10 text-destructive border-destructive/20', pulse: false },
      'queued': { color: 'bg-violet-500/10 text-violet-600 border-violet-200', pulse: true },
      'sending': { color: 'bg-sky-500/10 text-sky-600 border-sky-200', pulse: true },
      'pending': { color: 'bg-muted text-muted-foreground border-border', pulse: false }
    };

    const sVal = normalizedStatus || 'pending';
    const style = config[sVal] || config.pending;

    return (
      <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border shadow-sm ${style.color}`}>
        {style.pulse && <span className="mr-1.5 h-1 w-1 rounded-full bg-current animate-pulse" />}
        {sVal}
      </Badge>
    );

  };

  const handleExport = async () => {
    try {
        toast.info("Preparing report download...");
        window.open(getCampaignExportUrl(campaignId), '_blank');
    } catch {
        toast.error("Failed to start export");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search name, phone, message id..." 
              className="pl-9 rounded-lg border-border/70 bg-background w-full"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {isFetching && !isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[150px] rounded-lg border-border/70 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
            variant="outline" 
            className="rounded-lg font-semibold border-border/70 gap-2 w-full sm:w-auto hover:bg-muted/50"
            onClick={handleExport}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="hidden border border-border/70 rounded-xl overflow-x-auto overflow-y-hidden bg-background md:block">
        <Table className="min-w-[760px] w-full">
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="px-4 py-3 text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">Recipient</TableHead>
              <TableHead className="px-4 py-3 text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">Status</TableHead>
              <TableHead className="px-4 py-3 text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest">Message Timeline</TableHead>
              <TableHead className="px-4 py-3 text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center bg-transparent">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">Fetching Recipients...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center bg-transparent">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="rounded-full border border-destructive/20 bg-destructive/10 p-3 text-destructive">
                      <Filter className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-foreground">Could not load recipient activity</h3>
                      <p className="text-xs">Refresh the table to try again.</p>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => refetch()}>
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                   <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 border border-border">
                      <Filter className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No activity found</h3>
                    <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
                      Try adjusting the filters or search term to see recipient data.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              messages.map((msg: any) => (
                <TableRow key={msg._id} className="hover:bg-muted/20 border-border/50 transition-colors">
                  <TableCell className="px-4 py-4 align-top">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-sm truncate max-w-[220px]" title={getContactName(msg)}>
                        {getContactName(msg)}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">{getContactPhone(msg)}</span>
                      </p>
                      {msg.contact?.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[180px]">{msg.contact.email}</span>
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">{getStatusBadge(msg.status)}</TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      {getActivityRows(msg).length > 0 ? getActivityRows(msg).map((row) => (
                        <span key={row.label} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {row.label}: {row.value}
                        </span>
                      )) : (
                        <span className="text-xs text-muted-foreground">No timestamps yet</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right align-top">
                    {msg.status === 'failed' ? (
                       <p className="text-xs text-rose-600 font-medium max-w-[240px] ml-auto truncate" title={msg.failureReason || msg.lastError}>
                         {msg.failureReason || msg.lastError || 'Delivery Rejected'}
                       </p>
                    ) : msg.whatsappMessageId ? (
                       <p className="text-[11px] font-mono text-muted-foreground">{msg.whatsappMessageId.substring(0, 24)}...</p>
                    ) : <span className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">Awaiting provider id</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <div className="rounded-xl border border-border/70 bg-background p-6 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
            <p className="text-xs font-semibold uppercase tracking-widest">Fetching Recipients...</p>
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-border/70 bg-background p-5 text-center">
            <h3 className="text-sm font-semibold">Could not load recipient activity</h3>
            <p className="mt-1 text-xs text-muted-foreground">Refresh the table to try again.</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <Filter className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">No activity found</h3>
            <p className="mt-1 text-xs text-muted-foreground">Try a different status or search term.</p>
          </div>
        ) : (
          messages.map((msg: any) => (
            <article key={msg._id} className="rounded-xl border border-border/70 bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold" title={getContactName(msg)}>{getContactName(msg)}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{getContactPhone(msg)}</span>
                  </p>
                  {msg.contact?.email && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{msg.contact.email}</span>
                    </p>
                  )}
                </div>
                <div className="shrink-0">{getStatusBadge(msg.status)}</div>
              </div>

              <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
                {getActivityRows(msg).length > 0 ? getActivityRows(msg).map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCheck className="h-3 w-3" />
                      {row.label}
                    </span>
                    <span className="font-medium text-foreground">{row.value}</span>
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground">No timestamps recorded yet.</p>
                )}
              </div>

              {(msg.failureReason || msg.lastError || msg.whatsappMessageId) && (
                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
                  {msg.status === 'failed' ? (
                    <p className="break-words font-medium text-rose-600">{msg.failureReason || msg.lastError || 'Delivery rejected'}</p>
                  ) : (
                    <p className="break-all font-mono text-muted-foreground">{msg.whatsappMessageId}</p>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-xs font-bold text-muted-foreground">
            Showing Page {page} of {pagination.pages}
          </p>
          <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="icon" 
                className="rounded-lg h-8 w-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous recipient page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
                variant="outline" 
                size="icon" 
                className="rounded-lg h-8 w-8"
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                aria-label="Next recipient page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
