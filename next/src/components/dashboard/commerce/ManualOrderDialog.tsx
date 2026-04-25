"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  User, 
  Truck, 
  DollarSign, 
  Package,
  CheckCircle,
  Zap,
  Box
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualOrderDialog({ open, onOpenChange }: ManualOrderDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    pincode: '',
    paymentMethod: 'cod' as 'cod' | 'razorpay' | 'stripe'
  });

  // Fetch Products for search
  const { data: productsData } = useQuery({
    queryKey: ['products-search', search],
    queryFn: async () => {
      const resp: any = await api.get(`/commerce/products?search=${search}&limit=10`);
      return resp.products || [];
    },
    enabled: open && step === 1
  });

  // Fetch Global Commerce Settings for Tax/Shipping
  const { data: settings } = useQuery({
    queryKey: ['commerce-settings'],
    queryFn: async () => {
      const resp: any = await api.get('/commerce/settings');
      return resp.settings;
    },
    enabled: open
  });

  const createOrder = useMutation({
    mutationFn: (orderData: any) => api.post('/commerce/orders', orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success("Manual order launched successfully.");
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to launch order.");
    }
  });

  const resetForm = () => {
    setStep(1);
    setSelectedItems([]);
    setCustomer({
      name: '',
      phone: '',
      street: '',
      city: '',
      pincode: '',
      paymentMethod: 'cod'
    });
  };

  const addItem = (product: any) => {
    const existing = selectedItems.find(item => item.productId === product._id);
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.productId === product._id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setSelectedItems([...selectedItems, {
        productId: product._id,
        productName: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
        image: product.images?.[0]?.url
      }]);
    }
    toast.success(`${product.name} added to manifest.`);
  };

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty < 1) return;
    setSelectedItems(selectedItems.map(item => 
      item.productId === productId 
        ? { ...item, quantity: qty, subtotal: qty * item.price }
        : item
    ));
  };

  const calculateSubtotal = () => selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  
  const calculateTax = (subtotal: number) => {
    const taxRate = settings?.taxPercentage || 0;
    return (subtotal * taxRate) / 100;
  };

  const calculateShipping = (subtotal: number) => {
    if (!settings?.shipping?.enabled) return 0;
    if (settings.shipping.freeShippingAbove?.enabled && subtotal >= settings.shipping.freeShippingAbove.amount) {
      return 0;
    }
    return settings.shipping.flatRate?.amount || 0;
  };

  const subtotal = calculateSubtotal();
  const tax = calculateTax(subtotal);
  const shipping = calculateShipping(subtotal);
  const total = subtotal + tax + shipping;

  const handleSubmit = () => {
    if (selectedItems.length === 0) return toast.error("Manifest is empty.");
    if (!customer.name || !customer.phone) return toast.error("Contact details incomplete.");

    createOrder.mutate({
      items: selectedItems,
      subtotal,
      tax,
      taxPercentage: settings?.taxPercentage || 0,
      shippingCost: shipping,
      total,
      address: {
        name: customer.name,
        phone: customer.phone,
        street: customer.street,
        city: customer.city,
        pincode: customer.pincode,
        country: 'India'
      },
      paymentMethod: customer.paymentMethod,
      source: 'manual_dashboard'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-card border-none rounded-[40px] shadow-2xl">
        <div className="flex flex-col max-h-[90vh]">
           <DialogHeader className="p-10 pb-6 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
              <div className="flex items-center gap-4 mb-2">
                 <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-xl shadow-primary/5">
                    <Zap className="size-6" />
                 </div>
                 <div>
                    <DialogTitle className="text-3xl font-black tracking-tight">Launch Manual Unit</DialogTitle>
                    <DialogDescription className="text-xs font-semibold opacity-60 uppercase tracking-[0.2em] mt-1">Manual Commerce Orchestration</DialogDescription>
                 </div>
              </div>
           </DialogHeader>

           <div className="px-10 pb-4">
              <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border/40 gap-1">
                 <button 
                   onClick={() => setStep(1)}
                   className={cn(
                     "flex-1 rounded-xl py-2.5 font-black text-[9px] uppercase tracking-widest transition-all",
                     step === 1 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground opacity-40 hover:opacity-100"
                   )}
                 >
                    01. Inventory Sync
                 </button>
                 <button 
                   onClick={() => step > 1 && setStep(2)}
                   disabled={selectedItems.length === 0}
                   className={cn(
                     "flex-1 rounded-xl py-2.5 font-black text-[9px] uppercase tracking-widest transition-all",
                     step === 2 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground opacity-40 hover:opacity-100",
                     selectedItems.length === 0 && "cursor-not-allowed"
                   )}
                 >
                    02. Logistics Path
                 </button>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-8 custom-scrollbar mt-4">
              {step === 1 ? (
                <div className="space-y-6">
                   {/* Search Area */}
                   <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input 
                        placeholder="Search global inventory..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-12 h-12 rounded-2xl bg-card border-border/40 font-medium" 
                      />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Search Results */}
                      <div className="space-y-3">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40 px-1">Available Units</h4>
                         <ScrollArea className="h-[300px] pr-4">
                            <div className="space-y-2">
                               {productsData?.map((product: any) => (
                                 <div key={product._id} className="p-3 bg-muted/30 rounded-2xl border border-border/40 flex items-center justify-between group hover:border-primary/20 transition-all cursor-pointer" onClick={() => addItem(product)}>
                                    <div className="flex items-center gap-3">
                                       <div className="size-10 rounded-xl overflow-hidden border border-border/40">
                                          {product.images?.[0]?.url ? <img src={product.images[0].url} className="w-full h-full object-cover" /> : <Box className="size-full p-2 text-muted-foreground/30" />}
                                       </div>
                                       <div className="flex flex-col">
                                          <span className="text-xs font-bold leading-tight line-clamp-1">{product.name}</span>
                                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">₹{product.price}</span>
                                       </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="size-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                       <Plus className="size-4" />
                                    </Button>
                                 </div>
                               ))}
                               {!productsData?.length && (
                                 <div className="p-10 text-center opacity-20 flex flex-col items-center gap-2">
                                    <ShoppingBag className="size-10" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Search results empty</p>
                                 </div>
                               )}
                            </div>
                         </ScrollArea>
                      </div>

                      {/* Selected Manifest */}
                      <div className="space-y-3">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-primary px-1">Active Manifest ({selectedItems.length})</h4>
                         <ScrollArea className="h-[300px] border border-dashed border-primary/20 rounded-2xl p-4 bg-primary/[0.02]">
                            <div className="space-y-2">
                               {selectedItems.map((item) => (
                                 <div key={item.productId} className="flex items-center justify-between p-2 bg-background rounded-xl shadow-sm border border-border/10">
                                    <div className="flex items-center gap-2">
                                       <span className="text-[10px] font-bold line-clamp-1 w-24 leading-none">{item.productName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <input 
                                         type="number" 
                                         value={item.quantity} 
                                         onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value))}
                                         className="w-10 h-7 bg-muted/50 rounded-lg text-[10px] font-black text-center focus:outline-none"
                                       />
                                       <button onClick={() => removeItem(item.productId)} className="text-red-500/40 hover:text-red-500 transition-colors p-1">
                                          <Trash2 className="size-3" />
                                       </button>
                                    </div>
                                 </div>
                               ))}
                               {selectedItems.length === 0 && (
                                 <div className="h-full flex flex-col items-center justify-center py-10 opacity-20 italic">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Add units to begin manifest orchestration</p>
                                 </div>
                               )}
                            </div>
                         </ScrollArea>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                   {/* Contact Section */}
                   <div className="space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><User className="size-4" /></div>
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Entity Connection</h4>
                      </div>
                      <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 ml-1">Manifest Holder</Label>
                               <Input 
                                 placeholder="Name" 
                                 value={customer.name} 
                                 onChange={e => setCustomer({...customer, name: e.target.value})}
                                 className="h-11 rounded-xl bg-card border-border/40 font-bold text-sm" 
                               />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 ml-1">WhatsApp phone</Label>
                               <Input 
                                 placeholder="91xxxxxxxxxx" 
                                 value={customer.phone} 
                                 onChange={e => setCustomer({...customer, phone: e.target.value})}
                                 className="h-11 rounded-xl bg-card border-border/40 font-bold text-sm" 
                               />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 ml-1">Street Architecture</Label>
                            <Input 
                              placeholder="House, Street, Area" 
                              value={customer.street} 
                              onChange={e => setCustomer({...customer, street: e.target.value})}
                              className="h-11 rounded-xl bg-card border-border/40 font-bold text-sm" 
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 ml-1">City Node</Label>
                               <Input 
                                 placeholder="City" 
                                 value={customer.city} 
                                 onChange={e => setCustomer({...customer, city: e.target.value})}
                                 className="h-11 rounded-xl bg-card border-border/40 font-bold text-sm" 
                               />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 ml-1">Pincode</Label>
                               <Input 
                                 placeholder="Index" 
                                 value={customer.pincode} 
                                 onChange={e => setCustomer({...customer, pincode: e.target.value})}
                                 className="h-11 rounded-xl bg-card border-border/40 font-bold text-sm" 
                               />
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Payment Section */}
                   <div className="space-y-6">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><DollarSign className="size-4" /></div>
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Economic Settlement</h4>
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 ml-1">Gateway Protocol</Label>
                            <Select value={customer.paymentMethod} onValueChange={(v: any) => setCustomer({...customer, paymentMethod: v})}>
                               <SelectTrigger className="h-11 rounded-xl bg-card border-border/40 font-bold text-sm">
                                  <SelectValue />
                               </SelectTrigger>
                               <SelectContent className="rounded-2xl">
                                  <SelectItem value="cod">Cash on Delivery (Manual Sync)</SelectItem>
                                  <SelectItem value="razorpay">Razorpay Hub</SelectItem>
                                  <SelectItem value="stripe">Stripe Global</SelectItem>
                               </SelectContent>
                            </Select>
                         </div>
                         
                         <div className="p-6 bg-primary/5 rounded-[32px] border border-primary/10 space-y-4 mt-6">
                            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                               <span>Manifest Subtotal</span>
                               <span className="text-foreground">₹{subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                               <span>Sales Tax Index</span>
                               <span className="text-foreground">₹{tax.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                               <span>Logistics Fee</span>
                               <span className="text-foreground">₹{shipping.toLocaleString()}</span>
                            </div>
                            <div className="pt-3 border-t border-primary/10 flex items-center justify-between">
                               <span className="text-xs font-black uppercase tracking-widest">Grand Total</span>
                               <span className="text-2xl font-black tracking-tighter text-primary">₹{total.toLocaleString()}</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              )}
           </div>

           <DialogFooter className="p-10 bg-muted/10 border-t border-border/20 flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex items-center gap-3">
                 {step === 2 && (
                   <Button variant="ghost" onClick={() => setStep(1)} className="rounded-2xl h-12 px-6 font-black text-[10px] uppercase tracking-widest opacity-40">Previous Layer</Button>
                 )}
              </div>
              <div className="flex gap-3">
                 <Button onClick={() => onOpenChange(false)} variant="ghost" className="rounded-2xl h-12 px-8 font-black text-[10px] uppercase tracking-widest opacity-40">Abort Protocol</Button>
                 {step === 1 ? (
                   <Button 
                     onClick={() => setStep(2)} 
                     disabled={selectedItems.length === 0}
                     className="rounded-2xl h-12 px-8 font-black shadow-xl shadow-primary/20 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2"
                   >
                     Continue Execution <Truck className="size-4" />
                   </Button>
                 ) : (
                   <Button 
                     onClick={handleSubmit}
                     disabled={createOrder.isPending}
                     className="rounded-2xl h-12 px-10 font-black shadow-xl shadow-primary/20 bg-emerald-500 text-white text-[10px] uppercase tracking-[0.2em] gap-2 border-none hover:bg-emerald-600"
                   >
                     Launch Unit <Package className="size-4" />
                   </Button>
                 )}
              </div>
           </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
