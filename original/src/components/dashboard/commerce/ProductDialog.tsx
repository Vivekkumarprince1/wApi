"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Package, 
  Plus, 
  Image as ImageIcon, 
  Tag, 
  Box, 
  DollarSign,
  AlertCircle,
  X,
  Zap,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from './ImageUpload';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!product;

  const [form, setForm] = useState<any>({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    currency: 'INR',
    category: '',
    isActive: true,
    images: []
  });

  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    if (product && open) {
      setForm({
        ...product,
        images: product.images || []
      });
    } else if (!product && open) {
      setForm({
        name: '',
        description: '',
        price: 0,
        stock: 0,
        currency: 'INR',
        category: '',
        isActive: true,
        images: []
      });
    }
  }, [product, open]);

  const upsertProduct = useMutation({
    mutationFn: (data: any) => {
      if (isEditing) return api.put(`/commerce/products/${product._id}`, data);
      return api.post('/commerce/products', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(isEditing ? "Product updated." : "New product launched.");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Operation failed")
  });

  const handleAddImage = () => {
    if (!newImageUrl) return;
    setForm((prev: any) => ({
      ...prev,
      images: [...prev.images, { url: newImageUrl, isPrimary: prev.images.length === 0 }]
    }));
    setNewImageUrl('');
  };

  const removeImage = (index: number) => {
    setForm((prev: any) => ({
      ...prev,
      images: prev.images.filter((_: any, i: number) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.price < 0) return toast.error("Please fill required fields correctly.");
    upsertProduct.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-card border-none rounded-[40px] shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-8 pb-4 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
             <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                   <Package className="size-6" />
                </div>
                <div>
                   <DialogTitle className="text-2xl font-black tracking-tight">{isEditing ? 'Architect Product' : 'Launch New Product'}</DialogTitle>
                   <DialogDescription className="text-xs font-semibold opacity-60 uppercase tracking-widest">Inventory Intelligence Suite</DialogDescription>
                </div>
             </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 custom-scrollbar">
             {/* Identity Section */}
             <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1 border-l-2 border-primary/40 leading-none">Identity & Narrative</h4>
                <div className="grid gap-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Product Designation</Label>
                      <Input 
                        placeholder="Elite Performance Gear" 
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        className="h-12 rounded-2xl bg-muted/20 border-border/40 font-black px-4 bg-card/50" 
                      />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Narrative Description</Label>
                      <Textarea 
                        placeholder="Detail the unique value proposition..." 
                        value={form.description}
                        onChange={e => setForm({...form, description: e.target.value})}
                        className="rounded-2xl bg-muted/20 border-border/40 min-h-[100px] p-4 font-medium leading-relaxed bg-card/50" 
                      />
                   </div>
                </div>
             </div>

             {/* Financials & Stock */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1 border-l-2 border-emerald-500/40 leading-none">Financials</h4>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit Price</Label>
                         <div className="relative">
                            <Input 
                              type="number" 
                              value={form.price}
                              onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})}
                              className="h-10 rounded-xl bg-card/30 border-border/40 font-black pl-8" 
                            />
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground opacity-40" />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Currency</Label>
                         <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                            <SelectTrigger className="h-10 rounded-xl bg-card/30 border-border/40 font-bold">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                               <SelectItem value="INR">INR (₹)</SelectItem>
                               <SelectItem value="USD">USD ($)</SelectItem>
                               <SelectItem value="EUR">EUR (€)</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1 border-l-2 border-amber-500/40 leading-none">Logistics</h4>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Current Stock</Label>
                         <div className="relative">
                            <Input 
                              type="number" 
                              value={form.stock}
                              onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})}
                              className="h-10 rounded-xl bg-card/30 border-border/40 font-black pl-8" 
                            />
                            <Box className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground opacity-40" />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                         <Input 
                           placeholder="General" 
                           value={form.category}
                           onChange={e => setForm({...form, category: e.target.value})}
                           className="h-10 rounded-xl bg-card/30 border-border/40 font-bold" 
                         />
                      </div>
                   </div>
                </div>
             </div>

             {/* Visual Assets */}
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-1 border-l-2 border-purple-500/40 leading-none">Visual Assets</h4>
                   <Badge variant="outline" className="text-[9px] uppercase tracking-tighter opacity-40">{form.images.length} Loaded</Badge>
                </div>
                <div className="space-y-4">
                   <ImageUpload 
                      folder={`commerce/products/${product?.workspaceId || 'global'}`}
                      onUpload={(url) => {
                        setForm((prev: any) => ({
                          ...prev,
                          images: [...prev.images, { url, isPrimary: prev.images.length === 0 }]
                        }));
                      }}
                    />
                   
                   <div className="grid grid-cols-4 gap-4">
                      {form.images.map((img: any, i: number) => (
                        <div key={i} className="relative aspect-square rounded-2xl bg-card/30 border border-border/40 overflow-hidden group">
                           <img src={img.url} className="w-full h-full object-cover" />
                           <button 
                             type="button"
                             onClick={() => removeImage(i)}
                             className="absolute top-1 right-1 size-6 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                              <X className="size-3" />
                           </button>
                           {img.isPrimary && (
                             <div className="absolute bottom-1 left-1 bg-primary text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">Primary</div>
                           )}
                        </div>
                      ))}
                      {form.images.length === 0 && (
                        <div className="col-span-4 h-24 rounded-2xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 opacity-40">
                           <ImageIcon className="size-5" />
                           <p className="text-[9px] font-bold uppercase tracking-widest">No assets provided</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>

             {/* Deployment Status */}
             <div className="flex items-center justify-between p-6 bg-primary/5 rounded-[24px] border border-primary/10">
                <div className="space-y-1">
                   <Label className="text-sm font-black tracking-tight">Deployment Status</Label>
                   <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">Should this be visible on WhatsApp Storefront?</p>
                </div>
                <div className="flex items-center gap-3">
                   <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", form.isActive ? "text-primary" : "text-muted-foreground")}>
                      {form.isActive ? 'Active' : 'Offline'}
                   </span>
                   <Switch checked={form.isActive} onCheckedChange={v => setForm({...form, isActive: v})} />
                </div>
             </div>
          </div>

          <DialogFooter className="p-8 bg-muted/5 border-t border-border/20">
             <Button 
               type="button" 
               variant="ghost" 
               onClick={() => onOpenChange(false)}
               className="rounded-2xl h-12 px-6 font-black text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100"
             >
                Cancel
             </Button>
             <Button 
               type="submit" 
               disabled={upsertProduct.isPending}
               className="rounded-2xl h-12 px-10 font-black shadow-xl shadow-primary/20 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2"
             >
                {upsertProduct.isPending ? <Zap className="size-4 animate-spin" /> : <Check className="size-4" />}
                {isEditing ? 'Sync Changes' : 'Execute Launch'}
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ children, className, variant = 'default' }: any) {
  return (
    <div className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold",
      variant === 'outline' ? "border border-border/40 text-muted-foreground" : "bg-primary text-primary-foreground",
      className
    )}>
      {children}
    </div>
  );
}
