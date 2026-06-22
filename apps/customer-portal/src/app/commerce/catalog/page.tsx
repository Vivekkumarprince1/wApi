"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Plus,
  Search,
  Filter,
  MoreVertical,
  Package,
  ShoppingBag,
  AlertTriangle,
  Image as ImageIcon,
  Tag,
  Box,
  LayoutGrid,
  List,
  Trash2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { deleteProduct as deleteProductApi, fetchProductsList } from '@/lib/api/commerce';
import FlashLoader from '@/components/ui/flash-loader';
import { ProductDialog } from '@/components/dashboard/commerce/ProductDialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function CommerceCatalogPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Stats Query
  const { data: statsData } = useQuery({
    queryKey: ['product-stats'],
    queryFn: async () => {
      try {
        const resp: any = await fetchProductsList({ stats: true });
        return resp.data || {};
      } catch (err) {
        return {};
      }
    }
  });

  // Products Query
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', page, search, category],
    queryFn: async () => {
      try {
        const resp: any = await fetchProductsList({ page, search: search || undefined, category: category || undefined });
        return resp || { products: [], pagination: { total: 0, page: 1, pages: 1 } };
      } catch (err) {
        console.error("Failed to fetch products:", err);
        return { products: [], pagination: { total: 0, page: 1, pages: 1 } };
      }
    }
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => deleteProductApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      toast.success("Product deleted successfully.");
    },
    onError: () => toast.error("Failed to delete product.")
  });

  const products = productsData?.data || [];
  const pagination = productsData?.pagination || { total: 0, page: 1, pages: 1 };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const getCurrencySymbol = (code: string) => {
    switch (code) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '₹';
    }
  };

  if (isLoading) return <FlashLoader />;

  const statCards = [
    { label: "Elite Inventory", value: statsData?.total || 0, icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-500/5", border: "border-blue-500/10" },
    { label: "Active Nodes", value: statsData?.active || 0, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/5", border: "border-emerald-500/10" },
    { label: "Out of Stock", value: statsData?.outOfStock || 0, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/5", border: "border-amber-500/10" },
    { label: "Low Supply", value: statsData?.lowStock || 0, icon: Box, color: "text-purple-500", bg: "bg-purple-500/5", border: "border-purple-500/10" },
  ];

  return (
    <div className="flex flex-col gap-8 pb-32">
      {/* Catalog Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-foreground">Product Catalog</h1>
          <p className="text-muted-foreground text-sm font-medium opacity-60 flex items-center gap-2">
            Managing global inventory intelligence and storefront availability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border/40 scale-90 md:scale-100">
	            <Button
	              variant={view === 'grid' ? 'secondary' : 'ghost'}
	              size="sm"
	              onClick={() => setView('grid')}
	              aria-label="Show products as grid"
	              className="rounded-xl h-9 px-4 h-10 w-10 flex items-center justify-center p-0"
	            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
	              variant={view === 'list' ? 'secondary' : 'ghost'}
	              size="sm"
	              onClick={() => setView('list')}
	              aria-label="Show products as list"
	              className="rounded-xl h-9 px-4 h-10 w-10 flex items-center justify-center p-0"
	            >
              <List className="size-4" />
            </Button>
          </div>
          <Button 
            onClick={handleAdd}
            className="rounded-2xl h-12 px-8 font-black shadow-xl shadow-primary/20 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] gap-2"
          >
            <Plus className="size-4" /> New Product
          </Button>
        </div>
      </div>

      {/* Catalog Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative group p-6 bg-card border border-border/40 rounded-[32px] overflow-hidden"
          >
             <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2.5 rounded-xl", stat.bg, stat.color)}>
                   <stat.icon className="size-5" />
                </div>
                <Badge variant="outline" className="rounded-lg text-[8px] font-black uppercase tracking-widest border-border/40 opacity-40">Live Sync</Badge>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none">{stat.label}</p>
                <h3 className="text-2xl font-black tracking-tight">{stat.value}</h3>
             </div>
             <div className={cn("absolute -bottom-10 -right-10 w-24 h-24 blur-[40px] opacity-10 rounded-full", stat.bg)} />
          </motion.div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search catalog intelligence..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-12 h-12 rounded-2xl bg-card border-border/40 font-medium" 
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <div className="flex bg-muted/40 p-1.5 rounded-2xl border border-border/40 shrink-0">
             {['All', 'Electronics', 'Apparel', 'Services'].map((cat) => (
               <Button
                 key={cat}
                 onClick={() => setCategory(cat === 'All' ? null : cat)}
                 variant={category === (cat === 'All' ? null : cat) ? 'secondary' : 'ghost'}
                 size="sm"
                 className="rounded-xl h-9 px-5 font-black text-[9px] uppercase tracking-widest"
               >
                 {cat}
               </Button>
             ))}
          </div>
          {category && (
            <Button 
	               variant="ghost" 
	               size="icon" 
	               onClick={() => setCategory(null)}
	               aria-label="Clear product category filter"
	               className="size-11 rounded-2xl shrink-0"
	            >
               <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Product Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        <AnimatePresence mode="popLayout">
          {products.map((product: any, i: number) => (
            <motion.div
              layout
              key={product._id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="group border-none ring-1 ring-border/40 bg-card overflow-hidden rounded-[40px] shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
                  {product.images?.[0]?.url ? (
                    <img 
                      src={product.images[0].url} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground/30">
                      <ImageIcon className="size-12" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <Badge
                      className={cn(
                        "rounded-xl font-black border-none text-[8px] uppercase tracking-widest px-3 py-1",
                        product.isActive 
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                          : "bg-slate-500 text-white"
                      )}
                    >
                      {product.isActive ? 'Visible' : 'Archived'}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-8 space-y-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{product.category || 'General'}</span>
                    <h3 className="text-xl font-bold tracking-tight line-clamp-1">{product.name}</h3>
                  </div>

                  <div className="flex items-end justify-between pt-4 border-t border-border/40">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none opacity-40">Revenue Unit</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-2xl font-black tracking-tighter text-emerald-500">
                          {getCurrencySymbol(product.currency)}{product.price.toLocaleString()}
                        </span>
                        <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">{product.currency}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none opacity-40">Logistics Status</p>
                      <div className={cn(
                        "text-xs font-black pt-1",
                        product.stock <= 5 ? "text-red-500 animate-pulse" : "text-foreground"
                      )}>
                        {product.stock.toString().padStart(2, '0')} Units
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button 
                       onClick={() => handleEdit(product)}
                       variant="outline" 
                       className="flex-1 h-11 rounded-[1.25rem] border-border/40 font-black text-[10px] uppercase tracking-widest hover:bg-primary/5 hover:border-primary/20"
                    >
                      Configure
                    </Button>
	                    <DropdownMenu>
	                      <DropdownMenuTrigger asChild>
	                        <Button variant="outline" size="icon" aria-label={`Open actions for ${product.name}`} className="h-11 w-11 rounded-[1.25rem] border-border/40">
	                          <MoreVertical className="size-4" />
	                        </Button>
	                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 p-2 rounded-[24px] shadow-2xl border-none ring-1 ring-border/20">
                        <DropdownMenuItem className="rounded-xl h-11 px-4 font-bold text-xs" onClick={() => handleEdit(product)}>Duplicate Listing</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { router.push('/analytics/advanced'); }} className="rounded-xl h-11 px-4 font-bold text-xs">Analytics Digest</DropdownMenuItem>
                        <div className="h-px bg-border/40 my-2" />
                        <DropdownMenuItem 
                           className="rounded-xl h-11 px-4 font-bold text-xs text-red-500 focus:bg-red-50"
                           onClick={() => deleteProduct.mutate(product._id)}
                        >
                           Destruct Product
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {products.length === 0 && (
          <div className="col-span-full p-32 flex flex-col items-center justify-center gap-6 bg-card/60 backdrop-blur-xl border border-dashed border-border/40 rounded-[60px]">
             <div className="p-8 bg-primary/5 rounded-full text-primary/20">
                <Package className="size-20" />
             </div>
             <div className="text-center space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-widest text-foreground">Catalog Depleted</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">Launch a new intelligence node to populate the manifest</p>
             </div>
             <Button onClick={handleAdd} variant="outline" className="rounded-2xl h-11 px-8 font-black text-[10px] uppercase tracking-widest">Architect New Unit</Button>
          </div>
        )}

        {/* Global Catalog Footer / Pagination */}
        <div className="col-span-full pt-10 flex flex-col md:flex-row items-center justify-between gap-6 px-4">
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
             Indexing {products.length} of {pagination.total} catalog units
           </p>
           <div className="flex items-center bg-muted/30 p-1.5 rounded-2xl border border-border/40">
	              <Button 
	                variant="ghost" 
	                size="sm" 
	                disabled={page === 1}
	                onClick={() => setPage(p => p - 1)}
	                aria-label="Previous product page"
	                className="rounded-xl size-10 flex items-center justify-center p-0"
	              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="px-6 text-[10px] font-black uppercase tracking-widest">
                Node {page} / {pagination.pages}
              </div>
	              <Button 
	                variant="ghost" 
	                size="sm" 
	                disabled={page === pagination.pages}
	                onClick={() => setPage(p => p + 1)}
	                aria-label="Next product page"
	                className="rounded-xl size-10 flex items-center justify-center p-0"
	              >
                <ChevronRight className="size-4" />
              </Button>
           </div>
        </div>
      </div>

      <ProductDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
      />
    </div>
  );
}
