'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  Tag, 
  DollarSign, 
  Layers, 
  Image as ImageIcon, 
  Check, 
  AlertCircle,
  Loader2,
  Trash2,
  Plus
} from 'lucide-react';

export default function ProductModal({ isOpen, onClose, onSave, product = null, loading = false }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    currency: 'INR',
    stock: 0,
    category: 'General',
    isActive: true,
    images: []
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price || 0,
        currency: product.currency || 'INR',
        stock: product.stock || 0,
        category: product.category || 'General',
        isActive: product.isActive !== undefined ? product.isActive : true,
        images: product.images || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: 0,
        currency: 'INR',
        stock: 0,
        category: 'General',
        isActive: true,
        images: []
      });
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const addImagePlaceholder = () => {
    const url = prompt('Enter image URL (Placeholder for now):');
    if (url) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, { url, alt: formData.name, isPrimary: prev.images.length === 0 }]
      }));
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const inputClass = "w-full bg-muted/20 border border-border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl">
              <Package className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {product ? 'Refine Product' : 'Onboard New Product'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Product Identity</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                  <input 
                    name="name" required value={formData.name} onChange={handleChange}
                    placeholder="e.g. Premium Wireless Headphones" className={`${inputClass} pl-11`} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Classification</label>
                <div className="relative">
                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                  <input 
                    name="category" value={formData.category} onChange={handleChange}
                    placeholder="e.g. Electronics" className={`${inputClass} pl-11`} 
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Narrative/Features</label>
              <textarea 
                name="description" value={formData.description} onChange={handleChange}
                placeholder="Describe the product value proposition..."
                rows="3" className={`${inputClass} resize-none py-3`} 
              />
            </div>

            {/* Pricing & Inventory */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 md:col-span-1">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Unit Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{formData.currency}</span>
                  <input 
                    type="number" name="price" required value={formData.price} onChange={handleChange}
                    className={`${inputClass} pl-12 text-right`} 
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Stock Level</label>
                <input 
                  type="number" name="stock" required value={formData.stock} onChange={handleChange}
                  className={`${inputClass} text-center`} 
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-10 h-6 rounded-full transition-all relative ${formData.isActive ? 'bg-primary' : 'bg-muted'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isActive ? 'left-5' : 'left-1'}`} />
                  </div>
                  <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} className="hidden" />
                  <span className="text-sm font-bold text-foreground">Active</span>
                </label>
              </div>
            </div>

            {/* Media/Images */}
            <div className="space-y-3">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center justify-between">
                <span>Product Visuals</span>
                <span className="text-[10px] text-primary underline cursor-pointer" onClick={addImagePlaceholder}>Add via URL</span>
              </label>
              <div className="flex flex-wrap gap-4">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative w-2 group">
                    <div className="w-20 h-20 rounded-2xl border-2 border-border overflow-hidden bg-muted flex items-center justify-center">
                      <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                    </div>
                    <button 
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={addImagePlaceholder}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-1 transition-all text-muted-foreground hover:text-primary"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[10px] font-bold">Add</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-6 bg-muted/30 border-t border-border flex items-center justify-end gap-3">
          <button 
            type="button" onClick={onClose} disabled={loading}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-foreground hover:bg-muted transition-all"
          >
            Abort
          </button>
          <button 
            form="product-form"
            type="submit" disabled={loading}
            className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {product ? 'Synchronize' : 'Confirm'}
          </button>
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
