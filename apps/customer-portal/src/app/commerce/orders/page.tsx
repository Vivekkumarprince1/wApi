"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck, 
  DollarSign,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  User,
  CreditCard,
  ChevronLeft,
  ChevronDown,
  Box,
  TrendingUp,
  FileText,
  MessageSquare,
  Package,
  Trash2,
  Plus,
  Smartphone,
  AlertCircle,
  Zap
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from 'sonner';
import api from '@/lib/axios';
import FlashLoader from '@/components/ui/flash-loader';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ManualOrderDialog } from '@/components/dashboard/commerce/ManualOrderDialog';

const STATUS_CONFIG: Record<string, { color: string, icon: any, label: string }> = {
  pending: { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock, label: "Pending" },
  confirmed: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: CheckCircle, label: "Confirmed" },
  processing: { color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20", icon: ArrowUpRight, label: "Processing" },
  shipped: { color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: Truck, label: "Shipped" },
  delivered: { color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: CheckCircle, label: "Delivered" },
  cancelled: { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle, label: "Cancelled" },
};

export default function CommerceOrdersPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);

  // Orders Query
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', status, search, page],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        if (status !== 'all') params.append('status', status);
        if (search) params.append('search', search);

        const resp: any = await api.get(`/commerce/orders?${params.toString()}`);
        return resp || { data: [], pagination: { total: 0, page: 1, pages: 1 } };
      } catch (err) {
        console.error("[Orders Query Error]:", err);
        return { data: [], pagination: { total: 0, page: 1, pages: 1 } };
      }
    }
  });

  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string, status: string }) => 
      api.patch('/commerce/orders', { orderId, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success("Order status synchronized.");
    },
    onError: () => toast.error("Failed to update order.")
  });

  const syncOrderStatus = useMutation({
    mutationFn: (orderId: string) => api.put('/commerce/orders', { orderId }),
    onSuccess: (resp: any) => {
      toast.success(resp.message || "Logistics notification dispatched.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to trigger sync.");
    }
  });

  if (isLoading) return <FlashLoader />;

  const orders = ordersData?.data || [];
  const pagination = ordersData?.pagination || { total: 0, page: 1, pages: 1 };

  // Calculate dynamic stats from visible orders or API could provide this
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const throughput = orders.length;

  return (
    <div className="flex flex-col gap-8 pb-32">
        {/* Orders Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-foreground">Mission Logistics</h1>
            <p className="text-muted-foreground text-sm font-medium opacity-60 flex items-center gap-2">
              Command and fulfill global commerce units across the WhatsApp network.
            </p>
          </div>
          <div className="flex items-center gap-3">
             <Button
                variant="outline"
                onClick={() => {
                   if (!orders.length) { toast.error('No orders to export'); return; }
                   const cell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                   const headers = ['Order ID', 'Customer', 'Phone', 'Status', 'Total', 'Items', 'Created'];
                   const rows = orders.map((o: any) => [
                      o.orderNumber || o._id, o.customer?.name || o.customerName, o.customer?.phone || o.customerPhone,
                      o.status, o.total ?? o.totalAmount, (o.items || []).length, o.createdAt
                   ].map(cell).join(','));
                   const url = URL.createObjectURL(new Blob([[headers.map(cell).join(','), ...rows].join('\n')], { type: 'text/csv' }));
                   const a = Object.assign(document.createElement('a'), { href: url, download: 'orders.csv' });
                   a.click();
                   URL.revokeObjectURL(url);
                }}
                className="rounded-2xl border-border/40 h-11 px-6 font-black text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
                Export Manifest
             </Button>
              <Button 
                onClick={() => setIsManualOrderOpen(true)}
                className="rounded-2xl h-11 px-6 font-black shadow-xl shadow-primary/20 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2"
              >
                <Plus className="size-4" /> Launch Manual Order
              </Button>
          </div>
        </div>

        {/* Global Logistics Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {[
             { label: "Sales Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/5" },
             { label: "Order Throughput", value: throughput, icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-500/5" },
             { label: "Active Pipelines", value: orders.filter((o:any) => o.status === 'pending' || o.status === 'confirmed').length, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/5" },
             { label: "System Health", value: "99.9%", icon: ArrowUpRight, color: "text-purple-500", bg: "bg-purple-500/5" }
           ].map((stat, i) => (
             <motion.div
               key={stat.label}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               className="p-6 bg-card border border-border/40 rounded-[32px] group relative overflow-hidden"
             >
                <div className="flex items-center justify-between mb-4">
                   <div className={cn("p-2.5 rounded-xl", stat.bg, stat.color)}>
                      <stat.icon className="size-5" />
                   </div>
                   <Badge variant="outline" className="rounded-lg text-[8px] font-black uppercase tracking-widest border-border/40 opacity-40">Real-time</Badge>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{stat.label}</p>
                   <h3 className="text-2xl font-black tracking-tight">{stat.value}</h3>
                </div>
             </motion.div>
           ))}
        </div>

        {/* Status Pipeline Filter */}
        <Tabs value={status} onValueChange={setStatus} className="w-full">
           <TabsList className="bg-muted/30 p-1.5 rounded-2xl h-auto border border-border/40 gap-1 overflow-x-auto no-scrollbar justify-start">
             {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((st) => (
               <TabsTrigger 
                 key={st} 
                 value={st} 
                 className="rounded-xl px-6 py-2.5 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm min-w-[100px]"
               >
                 {st}
               </TabsTrigger>
             ))}
           </TabsList>

           <div className="mt-8 space-y-6">
              {/* Search Control */}
              <div className="relative flex-1 group max-w-xl">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                 <Input 
                   placeholder="Search orders, customers, or phone numbers..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="pl-12 h-12 rounded-2xl bg-card border-border/40 font-medium" 
                 />
              </div>

              {/* Orders Ecosystem */}
              <Card className="border-none ring-1 ring-border/40 bg-card/60 backdrop-blur-xl rounded-[40px] overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-muted/30 border-b border-border/40">
                             <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 w-1/4">Manifest ID & Node</th>
                             <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Entity Path</th>
                             <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Pipeline Status</th>
                             <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 text-right">Value Node</th>
                             <th className="p-6"></th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-border/20">
                          {orders.map((order: any, i: number) => {
                             const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                             return (
                                <motion.tr 
                                  key={order._id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="group hover:bg-primary/5 transition-all cursor-pointer"
                                  onClick={() => setSelectedOrder(order)}
                                >
                                   <td className="p-6">
                                      <div className="flex flex-col gap-1.5">
                                         <div className="flex items-center gap-2">
                                            <span className="font-black text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">
                                               {order.orderNumber || `ORD-${order._id.slice(-6).toUpperCase()}`}
                                            </span>
                                            <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                         </div>
                                         <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                                            <Clock className="size-3" />
                                            {formatDistanceToNow(new Date(order.createdAt))} ago
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-6">
                                      <div className="flex items-center gap-4">
                                         <div className="size-10 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center text-muted-foreground group-hover:border-primary/20 transition-colors">
                                            <User className="size-4" />
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="font-bold text-sm tracking-tight leading-none mb-1 text-foreground/80">{order.address?.name || 'Guest User'}</span>
                                            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">{order.address?.phone || 'No Linked Phone'}</span>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-6">
                                      <Badge variant="outline" className={cn("rounded-xl font-black text-[9px] uppercase tracking-widest border px-3 py-1.5 gap-2 shadow-sm", config.color)}>
                                         <config.icon className="size-3.5" />
                                         {config.label}
                                      </Badge>
                                   </td>
                                   <td className="p-6 text-right">
                                      <div className="flex flex-col items-end gap-0.5">
                                         <span className="text-xl font-black tracking-tighter text-foreground group-hover:text-primary transition-colors">₹{order.total?.toLocaleString()}</span>
                                         <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">{order.paymentMethod?.toUpperCase()} • {order.paymentStatus || 'UNPAID'}</span>
                                      </div>
                                   </td>
                                   <td className="p-6 text-right">
                                      <DropdownMenu>
                                         <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="size-10 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary">
                                               <MoreVertical className="size-4" />
                                            </Button>
                                         </DropdownMenuTrigger>
                                         <DropdownMenuContent align="end" className="w-64 p-2 rounded-[24px] shadow-2xl border-none ring-1 ring-border/20">
                                            <DropdownMenuItem onClick={() => setSelectedOrder(order)} className="rounded-xl h-11 px-4 font-bold text-xs gap-3">
                                               <FileText className="size-4 opacity-40" /> Order Architecture
                                            </DropdownMenuItem>
                                             <DropdownMenuItem 
                                               onClick={(e) => {
                                                  e.stopPropagation();
                                                  syncOrderStatus.mutate(order._id);
                                               }} 
                                               className="rounded-xl h-11 px-4 font-bold text-xs gap-3"
                                             >
                                                <MessageSquare className="size-4 opacity-40 text-primary" /> WhatsApp Update
                                             </DropdownMenuItem>
                                            <div className="h-px bg-border/40 my-2" />
                                            <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Transition Node</div>
                                            <DropdownMenuItem onClick={() => updateStatus.mutate({ orderId: order._id, status: 'confirmed' })} className="rounded-xl h-11 px-4 font-bold text-xs gap-3 text-blue-500">
                                               Confirm Manifest
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => updateStatus.mutate({ orderId: order._id, status: 'shipped' })} className="rounded-xl h-11 px-4 font-bold text-xs gap-3 text-purple-500">
                                               Mark Shipped
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => updateStatus.mutate({ orderId: order._id, status: 'delivered' })} className="rounded-xl h-11 px-4 font-bold text-xs gap-3 text-emerald-500">
                                               Mark Delivered
                                            </DropdownMenuItem>
                                            <div className="h-px bg-border/40 my-2" />
                                            <DropdownMenuItem
                                               onClick={() => {
                                                  if (window.confirm('Cancel this order?')) updateStatus.mutate({ orderId: order._id, status: 'cancelled' });
                                               }}
                                               className="rounded-xl h-11 px-4 font-bold text-xs gap-3 text-red-500 focus:bg-red-50">
                                               <Trash2 className="size-4" /> Cancel Order
                                            </DropdownMenuItem>
                                         </DropdownMenuContent>
                                      </DropdownMenu>
                                   </td>
                                </motion.tr>
                             );
                          })}

                          {orders.length === 0 && (
                             <tr>
                                <td colSpan={5} className="p-20 text-center">
                                   <div className="flex flex-col items-center gap-4 opacity-20">
                                      <ShoppingBag className="size-16" />
                                      <p className="text-xl font-black uppercase tracking-widest">No Active Manifests</p>
                                   </div>
                                </td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>

                 {/* Pagination Node */}
                 <div className="p-8 bg-muted/20 border-t border-border/20 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                       Indexing {orders.length} of {pagination.total} logistics nodes
                    </p>
                    <div className="flex items-center bg-card p-1.5 rounded-2xl border border-border/40 shadow-sm">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         disabled={page === 1}
                         onClick={() => setPage(p => p - 1)}
                         className="rounded-xl size-10 flex items-center justify-center p-0"
                       >
                         <ChevronLeft className="size-4" />
                       </Button>
                       <div className="px-8 text-[10px] font-black uppercase tracking-widest border-x border-border/20">
                         Node {page} / {pagination.pages}
                       </div>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         disabled={page === pagination.pages}
                         onClick={() => setPage(p => p + 1)}
                         className="rounded-xl size-10 flex items-center justify-center p-0"
                       >
                         <ChevronRight className="size-4" />
                       </Button>
                    </div>
                 </div>
              </Card>
           </div>
        </Tabs>

        {/* Order Details Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={(o) => !o && setSelectedOrder(null)}>
           <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-card border-none rounded-[40px] shadow-2xl">
              {selectedOrder && (
                <div className="flex flex-col max-h-[90vh]">
                   <DialogHeader className="p-10 pb-6 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                      <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-xl shadow-primary/5">
                               <Package className="size-6" />
                            </div>
                            <div>
                               <DialogTitle className="text-3xl font-black tracking-tight">{selectedOrder.orderNumber || 'Fulfillment Node'}</DialogTitle>
                               <DialogDescription className="text-xs font-semibold opacity-60 uppercase tracking-[0.2em] mt-1">Deep Architecture Analysis</DialogDescription>
                            </div>
                         </div>
                         <Badge variant="outline" className={cn("rounded-xl font-black text-[9px] uppercase tracking-widest border-2 px-4 py-2 shadow-sm", STATUS_CONFIG[selectedOrder.status]?.color)}>
                            {selectedOrder.status}
                         </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-border/40">
                         {[
                           { label: "Temporal Origin", value: format(new Date(selectedOrder.createdAt), 'MMM dd, HH:mm'), icon: Clock },
                           { label: "Entity Contact", value: selectedOrder.address?.name || 'Guest', icon: User },
                           { label: "Fulfillment Status", value: selectedOrder.status.toUpperCase(), icon: Truck },
                           { label: "Economic Value", value: `₹${selectedOrder.total}`, icon: DollarSign }
                         ].map((node) => (
                           <div key={node.label} className="space-y-1.5">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                 <node.icon className="size-3" /> {node.label}
                              </p>
                              <p className="text-xs font-black tracking-tight">{node.value}</p>
                           </div>
                         ))}
                      </div>
                   </DialogHeader>

                   <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-10 custom-scrollbar mt-4">
                      {/* Line Items */}
                      <div className="space-y-4">
                         <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1 border-l-2 border-primary/40 leading-none">Manifest Inventory</h4>
                         <div className="space-y-2">
                            {selectedOrder.items?.map((item: any, i: number) => (
                               <div key={i} className="flex items-center justify-between p-5 bg-muted/30 rounded-[24px] border border-border/40 group hover:border-primary/20 transition-all">
                                  <div className="flex items-center gap-4">
                                     <div className="size-12 rounded-2xl bg-card border border-border/40 overflow-hidden flex items-center justify-center">
                                        {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Box className="size-5 opacity-20" />}
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="font-black text-sm tracking-tight">{item.productName}</span>
                                        <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">Unit ID: {item.productId?.slice(-8).toUpperCase()}</span>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-8 text-right">
                                     <div className="flex flex-col">
                                        <span className="text-xs font-black">{item.quantity} x ₹{item.price}</span>
                                        <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Line Total</span>
                                     </div>
                                     <span className="text-lg font-black tracking-tighter">₹{item.subtotal}</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>

                      {/* Logistics Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1 border-l-2 border-emerald-500/40 leading-none">Entity Delivery Node</h4>
                            <div className="p-6 bg-emerald-500/5 rounded-[32px] border border-emerald-500/10 space-y-3">
                               <div className="flex items-center gap-3 text-emerald-600">
                                  <User className="size-4" />
                                  <span className="font-black text-xs uppercase tracking-widest">{selectedOrder.address?.name}</span>
                               </div>
                               <div className="text-xs font-medium leading-relaxed opacity-70 italic text-foreground/80">
                                  {selectedOrder.address?.street}, {selectedOrder.address?.city}<br/>
                                  {selectedOrder.address?.state} {selectedOrder.address?.pincode}<br/>
                                  {selectedOrder.address?.country}
                               </div>
                               <div className="pt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600/60">
                                  <Smartphone className="size-3" /> {selectedOrder.address?.phone}
                               </div>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1 border-l-2 border-amber-500/40 leading-none">Economic Summary</h4>
                            <div className="p-6 bg-card border border-border/40 rounded-[32px] space-y-4">
                               <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                                  <span>Subtotal</span>
                                  <span className="text-foreground">₹{selectedOrder.subtotal}</span>
                               </div>
                               <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                                  <span>Sales Tax</span>
                                  <span className="text-foreground">₹{selectedOrder.tax || 0}</span>
                               </div>
                               <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                                  <span>Logistics Fee</span>
                                  <span className="text-foreground">₹{selectedOrder.shipping || 0}</span>
                               </div>
                               <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                                  <span className="text-sm font-black uppercase tracking-widest">Final Grand Total</span>
                                  <span className="text-2xl font-black tracking-tighter text-emerald-500">₹{selectedOrder.total}</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   <DialogFooter className="p-10 bg-muted/10 border-t border-border/20 flex flex-col md:flex-row gap-4">
                      <div className="flex-1 flex items-center gap-3">
                         <div className="px-5 py-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <CreditCard className="size-4" /> {selectedOrder.paymentMethod?.toUpperCase()} • {selectedOrder.paymentStatus}
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <Button onClick={() => setSelectedOrder(null)} variant="ghost" className="rounded-2xl h-12 px-8 font-black text-[10px] uppercase tracking-widest opacity-40">Close Manifesto</Button>
                         <Button 
                           onClick={() => syncOrderStatus.mutate(selectedOrder._id)}
                           disabled={syncOrderStatus.isPending}
                           className="rounded-2xl h-12 px-8 font-black shadow-xl shadow-primary/20 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2"
                         >
                            {syncOrderStatus.isPending ? <Zap className="size-4 animate-spin text-white" /> : <MessageSquare className="size-4 text-white" />}
                            Execute Sync
                         </Button>
                      </div>
                   </DialogFooter>
                </div>
              )}
           </DialogContent>
        </Dialog>

        <ManualOrderDialog 
          open={isManualOrderOpen}
          onOpenChange={setIsManualOrderOpen}
        />
    </div>
  );
}
