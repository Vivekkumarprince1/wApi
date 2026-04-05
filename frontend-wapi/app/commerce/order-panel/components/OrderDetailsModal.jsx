'use client';

import { 
  X, 
  MapPin, 
  User, 
  Phone, 
  CreditCard, 
  Truck, 
  Package, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Printer
} from 'lucide-react';

export default function OrderDetailsModal({ isOpen, onClose, order }) {
  if (!isOpen || !order) return null;

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      'confirmed': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      'processing': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'shipped': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'delivered': 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20',
      'cancelled': 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[status?.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return <CheckCircle2 className="h-4 w-4" />;
      case 'cancelled': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-4xl bg-card border border-border shadow-2xl rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tighter">Order #{order.orderNumber || order.orderId || order._id?.substring(0, 8)}</h2>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-0.5 flex items-center gap-2">
                <Calendar className="h-3 w-3" /> {new Date(order.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
              <Printer className="h-5 w-5 text-white" />
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Customer & Shipping */}
            <div className="lg:col-span-1 space-y-6">
              <section>
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 ml-1">Customer Profile</h3>
                <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {(order.contactId?.name || order.contact?.name)?.[0] || 'U'}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{order.contactId?.name || order.contact?.name || 'Guest User'}</div>
                      <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {order.address?.phone || order.contactId?.phone || order.contact?.phone || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 ml-1">Delivery Destination</h3>
                <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 space-y-4">
                  <div className="flex gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-sm font-medium leading-relaxed text-muted-foreground">
                      <div className="text-foreground font-bold mb-1">{order.address?.name}</div>
                      {order.address?.street}<br />
                      {order.address?.city}, {order.address?.state} - {order.address?.pincode}<br />
                      {order.address?.country}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 ml-1">Transaction Identity</h3>
                <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Payment</span>
                    <span className="text-xs font-black text-primary uppercase">{order.paymentMethod || 'COD'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Status</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* Order Items */}
            <div className="lg:col-span-2">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 ml-1">Order Manifest</h3>
              <div className="bg-card border border-border shadow-sm rounded-[2rem] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-muted-foreground uppercase">Item</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-muted-foreground uppercase">Price</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-muted-foreground uppercase">Qty</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-muted-foreground uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {order.items?.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-muted/20 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden">
                              {item.image ? <img src={item.image} alt={item.productName} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <span className="text-sm font-bold text-foreground">{item.productName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">₹{item.price}</td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-foreground">{item.quantity}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-foreground">₹{item.subtotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals Section */}
                <div className="bg-muted/20 p-8 border-t border-border space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-muted-foreground">Subtotal</span>
                    <span className="font-black">₹{order.subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-muted-foreground">Logistics Fee</span>
                    <span className="font-black text-emerald-600">+ ₹{order.shippingCost || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-muted-foreground">Tax</span>
                    <span className="font-black text-rose-500">+ ₹{order.tax || 0}</span>
                  </div>
                  <div className="pt-4 mt-2 border-t border-border flex items-center justify-between">
                    <span className="text-lg font-black font-outfit uppercase tracking-tighter">Grand Total</span>
                    <span className="text-3xl font-black font-outfit tracking-tighter text-foreground decoration-primary decoration-4">₹{order.total}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-muted/40 border-t border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase opacity-50">
            Internal ID: {order._id}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-all"
            >
              Close
            </button>
            <button className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-black text-sm tracking-tight shadow-xl shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all">
              Mark as Shipped <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground)/0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
