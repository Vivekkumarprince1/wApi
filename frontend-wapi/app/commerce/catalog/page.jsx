'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Eye, 
  Loader2, 
  Box, 
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Layers,
  LayoutGrid,
  List
} from 'lucide-react';
import { get, post, put, del } from '@/lib/api';
import { toast } from '@/lib/toast';
import FeatureGate from '@/components/features/FeatureGate';
import ProductModal from './components/ProductModal';

function CatalogContent() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalProducts: 0, activeProducts: 0, categories: 0, outOfStock: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    loadProducts();
    loadStats();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await get('/products');
      const productList = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      setProducts(productList);
    } catch (err) {
      console.error('Failed to load products:', err);
      toast?.error?.('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await get('/products/stats');
      if (data) setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (formData) => {
    try {
      setActionLoading(true);
      if (editingProduct) {
        const updated = await put(`/products/${editingProduct._id || editingProduct.id}`, formData);
        setProducts(prev => prev.map(p => 
          (p._id || p.id) === (editingProduct._id || editingProduct.id) ? (updated.product || updated) : p
        ));
        toast?.success?.('Product synchronized successfully!');
      } else {
        const newProduct = await post('/products', formData);
        setProducts(prev => [newProduct.product || newProduct, ...prev]);
        toast?.success?.('Onboarding complete! New product added.');
      }
      setIsModalOpen(false);
      loadStats();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save product');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (confirm('Are you sure you want to decommission this product?')) {
      try {
        await del(`/products/${id}`);
        setProducts(prev => prev.filter(p => (p._id || p.id) !== id));
        loadStats();
        toast?.success?.('Product removed from catalog');
      } catch (err) {
        toast?.error?.(err.message || 'Failed to delete product');
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
      <p className="text-muted-foreground font-black tracking-widest text-[10px] uppercase">Retrieving Catalog...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in-up">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl shadow-primary/20">
            <ShoppingBag className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tighter font-outfit">Product Catalog</h1>
            <p className="text-muted-foreground font-medium text-sm mt-0.5 flex items-center gap-1.5">
              Curate your WhatsApp storefront <ChevronRight className="h-3 w-3" /> {products.length} Products
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-sm tracking-tight shadow-xl shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4.5 w-4.5" />
          Onboard Product
        </button>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Inventory Total', value: stats.totalProducts || products.length, icon: Box, color: 'text-primary' },
          { label: 'Active Matrix', value: stats.activeProducts || products.filter(p => p.isActive).length, icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Categories', value: stats.categories || new Set(products.map(p => p.category)).size, icon: Layers, color: 'text-blue-500' },
          { label: 'Zero Stock', value: stats.outOfStock || products.filter(p => p.stock === 0).length, icon: AlertTriangle, color: 'text-rose-500' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-card border border-border/50 rounded-[1.5rem] p-5 shadow-sm relative overflow-hidden group hover:border-primary/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color} group-hover:scale-110 transition-transform`} />
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
            type="text" placeholder="Search catalog by name or category..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-muted/20 border-none rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-1 bg-muted/40 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
          <button className="px-5 py-2.5 border border-border rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-20 bg-muted/10 border-2 border-dashed border-border rounded-[2.5rem] flex flex-col items-center justify-center grayscale opacity-50">
            <ShoppingBag className="h-12 w-12 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">No products in storage</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Begin by onboarding your first item</p>
          </div>
        ) : filteredProducts.map((product) => (
          <div 
            key={product._id || product.id} 
            className={`group bg-card rounded-[2rem] border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-500 overflow-hidden ${
              viewMode === 'list' ? 'flex items-center p-2' : ''
            }`}
          >
            {/* Visual */}
            <div className={`relative overflow-hidden ${viewMode === 'list' ? 'w-20 h-20 shrink-0 rounded-2xl' : 'h-48'}`}>
              <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                {product.images?.[0]?.url ? (
                  <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <Box className="h-8 w-8 text-muted-foreground/30" />
                )}
              </div>
              {product.stock === 0 && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                  <span className="px-3 py-1 bg-destructive text-white text-[10px] font-black uppercase rounded-full shadow-lg">Sold Out</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className={`p-6 flex-1 flex flex-col ${viewMode === 'list' ? 'px-4 py-0' : ''}`}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h3 className="font-bold text-foreground font-outfit tracking-tight group-hover:text-primary transition-colors truncate max-w-[150px]">{product.name}</h3>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{product.category || 'General'}</p>
                </div>
                <div className={`h-2.5 w-2.5 rounded-full ${product.isActive && product.stock > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`} />
              </div>

              <div className={`mt-auto pt-6 flex items-end justify-between ${viewMode === 'list' ? 'pt-0' : ''}`}>
                <div>
                  <div className="text-xl font-black tracking-tighter text-foreground decoration-primary decoration-2">
                    {product.currency?.toUpperCase() || 'INR'} {product.price?.toLocaleString()}
                  </div>
                  <p className={`text-[10px] font-bold tracking-tight mt-1 ${product.stock <= 5 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                    Stock: {product.stock} Units
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                  <button 
                    onClick={() => handleOpenEditModal(product)}
                    className="p-2.5 bg-muted/50 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-xl transition-all"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product._id || product.id)}
                    className="p-2.5 bg-muted/50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Modal */}
      <ProductModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        loading={actionLoading}
      />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <FeatureGate feature="products">
      <CatalogContent />
    </FeatureGate>
  );
}
