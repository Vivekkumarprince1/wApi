"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plug, Plus, Settings, ExternalLink, X } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-hot-toast';
import FlashLoader from '@/components/ui/FlashLoader';

const IntegrationsPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    setIsAuthenticated(true);

    fetchCatalog();
  }, [router]);

  const fetchCatalog = async () => {
    try {
      const response = await api.get('/integrations/catalog');
      setApps(response.data.data || []);
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectClick = (app) => {
    // If it's webhook or normal API Key, pop the modal
    if (app.authType === 'API_KEY' || app.authType === 'WEBHOOK') {
      setSelectedApp(app);
      setIsConnectModalOpen(true);
    } else if (app.authType === 'OAUTH2') {
      // Typically redirect to an OAuth route
      toast.error('OAuth flows are coming soon!');
    } else {
      toast.error('Native connection not configured');
    }
  };

  const handleDisconnectClick = async (app) => {
    if (!confirm(`Are you sure you want to disconnect ${app.name}?`)) return;
    try {
      await api.post(`/integrations/catalog/${app.slug}/disconnect`);
      toast.success(`${app.name} disconnected`);
      fetchCatalog();
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const submitConnection = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      await api.post(`/integrations/catalog/${selectedApp.slug}/connect`, {
        apiKey,
        storeUrl
      });
      toast.success(`${selectedApp.name} connected successfully!`);
      setIsConnectModalOpen(false);
      setApiKey('');
      setStoreUrl('');
      fetchCatalog();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  // Extract categories dynamically
  const categories = ['All', ...new Set(apps.map(a => a.category).filter(Boolean))];
  
  const filteredApps = activeCategory === 'All' 
    ? apps 
    : apps.filter(a => a.category === activeCategory);

  if (loading) return <FlashLoader />;

  if (!isAuthenticated) return null;

  if (error) return (
    <div className="p-6">
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">Error Loading Catalog</h1>
        <p className="text-destructive">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Plug className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">App Integrations</h1>
        </div>
        <p className="text-muted-foreground">
          Connect your favorite CRM, E-commerce, and Business apps in one click.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredApps.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/50 rounded-xl">
          <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No integrations available in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredApps.map((app) => (
            <div key={app._id} className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-premium transition-all duration-300 flex flex-col h-full">
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {app.logoUrl ? (
                      <img src={app.logoUrl} alt={app.name} className="w-full h-full object-cover" />
                    ) : (
                      <Plug className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{app.name}</h3>
                    <span className="text-xs font-medium text-muted-foreground">{app.category}</span>
                  </div>
                </div>
                {app.isConnected && (
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    CONNECTED
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">
                {app.description}
              </p>

              <div className="pt-4 border-t border-border/50 flex flex-col gap-3">
                {app.features?.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 mb-2">
                    {app.features.slice(0, 2).map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                        <span className="truncate">{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs font-medium bg-muted px-2 py-1 rounded-md text-foreground">
                    {app.planRequired === 'FREE' ? 'Free Plan' : `${app.planRequired} Plan`}
                  </span>

                  {app.isConnected ? (
                    <div className="flex gap-2">
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Configure">
                        <Settings className="w-5 h-5" />
                      </button>
                      <button 
                        className="text-destructive hover:text-destructive/80 transition-colors p-1" 
                        title="Disconnect"
                        onClick={() => handleDisconnectClick(app)}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleConnectClick(app)}
                      className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                    >
                      Connect <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Request Section */}
      <div className="mt-8 bg-primary/5 border border-primary/20 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-foreground mb-1">Didn't find your tool?</h3>
          <p className="text-sm text-muted-foreground">We build custom integrations for users on Growth and Advanced plans. Let our engineers hook it up for you.</p>
        </div>
        <button className="btn-primary whitespace-nowrap shrink-0">
          Request Integration
        </button>
      </div>

      {/* Connect Modal */}
      {isConnectModalOpen && selectedApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border/50 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsConnectModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-1">Connect {selectedApp.name}</h2>
            <p className="text-sm text-muted-foreground mb-6">Enter your {selectedApp.name} credentials to authorize access.</p>
            
            <form onSubmit={submitConnection} className="space-y-4">
              {['woocommerce', 'shopify'].includes(selectedApp.slug) && (
                 <div>
                   <label className="block text-sm font-medium mb-1.5 line-clamp-1">Store URL / Subdomain</label>
                   <input
                     type="text"
                     value={storeUrl}
                     onChange={(e) => setStoreUrl(e.target.value)}
                     placeholder="e.g. store.com"
                     className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                     required
                   />
                 </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5 cursor-pointer">API Key / Access Token</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Your ${selectedApp.name} secret key`}
                  className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsPage;
