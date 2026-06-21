"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  Loader2
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaign-messages', campaignId, page, status, search],
    queryFn: async () => {
      const response: any = await fetchCampaignMessages(campaignId, { page, limit: 10, status, search });
      return response; // internal api returns response.data
    },
    refetchInterval: 10000 // Poll every 10s
  });

  const messages = data?.messages || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  const getStatusBadge = (s: string) => {
    const normalizedStatus = (s || '').toLowerCase();
    const config: any = {
      'sent': { color: 'bg-blue-500/10 text-blue-600 border-blue-200', pulse: false },
      'delivered': { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', pulse: false },
      'read': { color: 'bg-indigo-500/10 text-indigo-500 border-indigo-200', pulse: false },
      'failed': { color: 'bg-destructive/10 text-destructive border-destructive/20', pulse: false },
      'queued': { color: 'bg-violet-500/10 text-violet-600 border-violet-200', pulse: true },
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
    } catch (error) {
        toast.error("Failed to start export");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search phone or name..." 
              className="pl-9 rounded-xl border-border/50 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px] rounded-xl border-border/50 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
            variant="outline" 
            className="rounded-xl font-bold border-border/50 gap-2 w-full md:w-auto hover:bg-muted/50"
            onClick={handleExport}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-[40px] overflow-hidden bg-background shadow-premium-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Recipient</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Status</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Engagement</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest text-right">Activity Details</TableHead>
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
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center">
                   <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
                    <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mb-4 shadow-premium-sm border border-primary/10">
                      <Filter className="h-8 w-8 text-primary opacity-30" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1">No activity found</h3>
                    <p className="text-xs text-muted-foreground max-w-[200px] mx-auto font-medium">
                      Try adjusting the filters or search term to see recipient data.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              messages.map((msg: any) => (
                <TableRow key={msg._id} className="hover:bg-muted/20 border-border/50 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-bold text-sm">{msg.contact?.name || 'Unknown'}</p>
                      <p className="text-[10px] font-black tracking-tighter text-muted-foreground">{msg.phone || msg.contact?.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(msg.status)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {msg.sentAt && <p className="text-[10px] font-medium text-muted-foreground">Sent: {new Date(msg.sentAt).toLocaleTimeString()}</p>}
                      {msg.readAt && <p className="text-[10px] font-medium text-indigo-500">Read: {new Date(msg.readAt).toLocaleTimeString()}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {msg.status === 'failed' ? (
                       <p className="text-[10px] text-rose-500 font-bold max-w-[200px] ml-auto truncate" title={msg.failureReason || msg.lastError}>
                         {msg.failureReason || msg.lastError || 'Delivery Rejected'}
                       </p>
                    ) : msg.whatsappMessageId ? (
                       <p className="text-[10px] font-mono text-muted-foreground opacity-50">{msg.whatsappMessageId.substring(0, 16)}...</p>
                    ) : <span className="text-muted-foreground opacity-20 text-[10px] font-black tracking-widest uppercase">Awaiting Action</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
                className="rounded-xl h-8 w-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
                variant="outline" 
                size="icon" 
                className="rounded-xl h-8 w-8"
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
