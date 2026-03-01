'use client';

import { FaShoppingBag, FaPlus, FaSearch, FaFilter, FaEdit, FaTrash, FaEye, FaSpinner } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { get, post, put, del } from '@/lib/api';
import { toast } from 'react-toastify';
import FeatureGate from '@/components/FeatureGate';

function CatalogContent(){
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

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
      toast?.error?.('Failed to load products') || alert('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await get('/products/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleAddProduct = async () => {
    const name = prompt('Enter product name:');
    if (!name) return;
    const category = prompt('Enter category:');
    const priceStr = prompt('Enter price (number only, e.g., 999):');
    const stockStr = prompt('Enter stock quantity:');
    
    if (name && priceStr && stockStr) {
      try {
        const newProduct = await post('/products', {
          name,
          category: category || 'General',
          price: parseFloat(priceStr),
          stock: parseInt(stockStr),
          currency: 'INR',
          isActive: parseInt(stockStr) > 0
        });
        setProducts(prev => [newProduct.product || newProduct, ...prev]);
        loadStats();
        toast?.success?.('Product added successfully!') || alert('✅ Product added successfully!');
      } catch (err) {
        toast?.error?.(err.message || 'Failed to add product') || alert(err.message);
      }
    }
  };

  const handleEditProduct = async (product) => {
    const name = prompt('Edit product name:', product.name);
    const priceStr = prompt('Edit price (number only):', product.price);
    const stockStr = prompt('Edit stock quantity:', product.stock);
    
    if (name && priceStr && stockStr !== null) {
      try {
        const updated = await put(`/products/${product._id || product.id}`, {
          name,
          price: parseFloat(priceStr),
          stock: parseInt(stockStr),
          isActive: parseInt(stockStr) > 0
        });
        setProducts(prev => prev.map(p => 
          (p._id || p.id) === (product._id || product.id) ? (updated.product || updated) : p
        ));
        loadStats();
        toast?.success?.('Product updated successfully!') || alert('✅ Product updated successfully!');
      } catch (err) {
        toast?.error?.(err.message || 'Failed to update product') || alert(err.message);
      }
    }
  };

  const handleDeleteProduct = async (id) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await del(`/products/${id}`);
        setProducts(prev => prev.filter(p => (p._id || p.id) !== id));
        loadStats();
        toast?.success?.('Product deleted successfully!') || alert('✅ Product deleted successfully!');
      } catch (err) {
        toast?.error?.(err.message || 'Failed to delete product') || alert(err.message);
      }
    }
  };

  const handleViewProduct = (product) => {
    alert(`Product Details:\n\nName: ${product.name}\nCategory: ${product.category}\nPrice: ₹${product.price}\nStock: ${product.stock}\nStatus: ${product.isActive ? 'Active' : 'Out of Stock'}`);
  };

  const filteredProducts = searchQuery 
    ? products.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  if (loading) {
    return (
      <div className=" flex items-center justify-center">
        <FaSpinner className="animate-spin text-3xl text-primary" />
      </div>
    );
  }

  return (
    <div className="">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-primary to-primary/80 shadow-premium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <FaShoppingBag className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Product Catalog</h1>
                <p className="text-white/90 text-sm mt-1">Manage your WhatsApp Commerce products</p>
              </div>
            </div>
            <button 
              onClick={handleAddProduct}
              className="flex items-center space-x-2 px-5 py-2.5 bg-white text-primary rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105"
            >
              <FaPlus />
              <span>Add Product</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">Total Products</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">{stats?.totalProducts || products.length}</p>
          </div>
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">Active Products</p>
            <p className="text-3xl font-bold text-foreground">{stats?.activeProducts || (Array.isArray(products) ? products.filter(p => p.isActive).length : 0)}</p>
          </div>
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">Categories</p>
            <p className="text-3xl font-bold text-foreground">{stats?.categories || (Array.isArray(products) ? new Set(products.map(p => p.category)).size : 0)}</p>
          </div>
          <div className="bg-card rounded-2xl shadow-premium p-6">
            <p className="text-muted-foreground text-sm mb-1">Out of Stock</p>
            <p className="text-3xl font-bold text-red-500">{stats?.outOfStock || (Array.isArray(products) ? products.filter(p => p.stock === 0).length : 0)}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-card rounded-2xl shadow-premium p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl bg-white dark:bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button className="px-4 py-2.5 border border-border rounded-xl hover:bg-accent transition-colors">
              <FaFilter className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No products found. Add your first product!</p>
            </div>
          ) : filteredProducts.map((product) => (
            <div key={product._id || product.id} className="bg-card rounded-2xl shadow-premium overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 h-48 flex items-center justify-center text-6xl">
                {product.images?.[0]?.url ? (
                  <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
                ) : '📦'}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.category || 'General'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    product.isActive && product.stock > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
                  }`}>{product.isActive && product.stock > 0 ? 'Active' : 'Out of Stock'}</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">₹{product.price}</p>
                    <p className="text-sm text-muted-foreground">Stock: {product.stock}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleViewProduct(product)}
                      className="p-2 text-primary hover:bg-primary hover:text-white rounded-xl transition-colors"
                    >
                      <FaEye />
                    </button>
                    <button 
                      onClick={() => handleEditProduct(product)}
                      className="p-2 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl transition-colors"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product._id || product.id)}
                      className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
