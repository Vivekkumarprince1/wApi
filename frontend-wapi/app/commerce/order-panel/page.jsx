'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Eye, 
  CheckCircle2, 
  Truck, 
  Loader2, 
  Package, 
  ChevronRight, 
  Calendar, 
  CreditCard, 
  MoreHorizontal,
  ChevronDown,
  LayoutList,
  RefreshCcw,
  Clock
} from 'lucide-react';
import { get, put } from '@/lib/api';
import { toast } from '@/lib/toast';
import FeatureGate from '@/components/features/FeatureGate';
import OrderDetailsModal from './components/OrderDetailsModal';

function OrderPanelContent() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingOrder, setViewingOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // track which order is updating

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '100');
      const response = await get(`/checkout-bot/orders${params.toString() ? '?' + params : ''}`);
      // Backend returns { success, data: [...], pagination: {...} }
      const result = response?.data || response?.orders || response;
      setOrders(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load orders:', err);
      toast?.error?.('Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setActionLoading(orderId);
      await put(`/checkout-bot/orders/${orderId}/status`, { status: newStatus });
      setOrders(prev => prev.map(o =>
        (o._id || o.id) === orderId ? { ...o, status: newStatus } : o
      ));
      toast?.success?.(`Order → ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
    } catch (err) {
      toast?.error?.(err.message || 'Failed to update order status');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'payment_initiated': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      'confirmed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      'processing': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'shipped': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'delivered': 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20',
      'cancelled': 'bg-destructive/10 text-destructive border-destructive/20',
      'failed': 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return colors[status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
  };

  // Next valid status for quick-action buttons based on Order model transitions
  const getNextAction = (status) => {
    const transitions = {
      'pending': { next: 'confirmed', label: 'Confirm', icon: CheckCircle2, color: 'hover:bg-emerald-500/10 hover:text-emerald-500' },
      'confirmed': { next: 'processing', label: 'Process', icon: MoreHorizontal, color: 'hover:bg-blue-500/10 hover:text-blue-500' },
      'processing': { next: 'shipped', label: 'Ship', icon: Truck, color: 'hover:bg-purple-500/10 hover:text-purple-500' },
      'shipped': { next: 'delivered', label: 'Deliver', icon: CheckCircle2, color: 'hover:bg-emerald-600/10 hover:text-emerald-600' },
    };
    return transitions[status?.toLowerCase()] || null;
  };

  const filteredOrders = searchQuery
    ? orders.filter(o =>
      o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o._id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.contactId?.name || o.contact?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : orders;

  // Dynamic stats computed from real order data
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'payment_initiated').length;
  const shippedCount = orders.filter(o => o.status === 'shipped').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
      <p className="text-muted-foreground font-black tracking-widest text-[10px] uppercase">Loading orders...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] flex items-center justify-center shadow-xl shadow-[#13C18D]/20">
            <ShoppingCart className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tighter font-outfit">Order Panel</h1>
            <p className="text-muted-foreground font-medium text-sm mt-0.5 flex items-center gap-1.5">
              Manage orders <ChevronRight className="h-3 w-3" /> {orders.length} total
            </p>
          </div>
        </div>
        
        <button 
          onClick={loadOrders}
          className="flex items-center gap-2 px-6 py-3 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-2xl border border-border shadow-sm transition-all"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: CreditCard, color: 'text-[#13C18D]' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-amber-500' },
          { label: 'Shipped', value: shippedCount, icon: Truck, color: 'text-purple-500' },
          { label: 'Delivered', value: deliveredCount, icon: CheckCircle2, color: 'text-emerald-500' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl bg-muted/50 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="text-2xl font-black tracking-tighter text-foreground">{stat.value}</div>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-muted/20 rounded-full group-hover:scale-150 transition-all duration-700" />
          </div>
        ))}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-8 bg-card border border-border/50 p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input 
            type="text" placeholder="Search by order number, ID, or customer..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-muted/20 border-none rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="relative shrink-0">
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none px-6 pr-11 py-2.5 bg-muted/40 border border-transparent rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all focus:outline-none"
          >
            <option value="">All Statuses</option>
            {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'].map(s => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card border border-border/50 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center opacity-40">
              <LayoutList className="h-12 w-12 mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">No orders found</p>
              <p className="text-xs text-muted-foreground mt-1">Orders placed via WhatsApp checkout will appear here</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Order</th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Customer</th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Items</th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Total</th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date</th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrders.map((order) => {
                  const contact = order.contactId || order.contact || {};
                  const nextAction = getNextAction(order.status);
                  return (
                    <tr key={order._id || order.id} className="group hover:bg-muted/20 transition-all duration-300">
                      <td className="px-8 py-5">
                        <div className="text-sm font-black text-foreground font-outfit uppercase tracking-tighter">
                          #{order.orderNumber || order._id?.substring(0, 8)}
                        </div>
                        <div className="text-[10px] font-medium text-muted-foreground mt-0.5">{order.paymentMethod?.toUpperCase() || 'COD'}</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                            {(contact.name || 'G')?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-foreground">{contact.name || 'Guest'}</div>
                            <div className="text-[10px] text-muted-foreground">{contact.phone || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-6 bg-muted/50 rounded-lg text-xs font-black text-muted-foreground">
                          {order.items?.length || 0}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="text-sm font-black text-foreground tracking-tighter">₹{(order.total || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${getStatusColor(order.status)}`}>
                          {order.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs">
                          <Calendar className="h-3 w-3" />
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setViewingOrder(order)}
                            className="p-2.5 bg-muted/50 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-xl transition-all"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {nextAction && (
                            <button
                              onClick={() => updateOrderStatus(order._id || order.id, nextAction.next)}
                              disabled={actionLoading === (order._id || order.id)}
                              className={`p-2.5 bg-muted/50 text-muted-foreground rounded-xl transition-all disabled:opacity-50 ${nextAction.color}`}
                              title={nextAction.label}
                            >
                              {actionLoading === (order._id || order.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <nextAction.icon className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal 
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        order={viewingOrder}
      />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}

export default function OrderPanelPage() {
  return (
    <FeatureGate feature="commerce">
      <OrderPanelContent />
    </FeatureGate>
  );
}
