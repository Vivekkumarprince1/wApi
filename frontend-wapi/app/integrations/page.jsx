"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plug, Plus } from 'lucide-react';
// Sidebar is rendered globally by LayoutWrapper
import { getIntegrations } from '@/lib/api';

const IntegrationsPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    setIsAuthenticated(true);

    const fetchIntegrations = async () => {
      try {
        const response = await getIntegrations();
        setIntegrations(response.data || []);
      } catch (err) {
        console.error('Error fetching integrations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchIntegrations();
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated) return null;

  if (error) return (
    <div className="p-6">
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">Error Loading Integrations</h1>
        <p className="text-destructive">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Plug className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
        </div>
        <p className="text-muted-foreground">
          {integrations.length > 0 ? `Connected with ${integrations.length} integration(s)` : 'Connect your favorite apps and tools to enhance your WhatsApp business capabilities.'}
        </p>
      </div>

      {integrations.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/50 rounded-xl">
          <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No integrations configured yet</p>
          <button className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Add Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {integrations.map((integration) => (
            <div key={integration._id || integration.id}
              className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-premium transition-all duration-300">
              <h3 className="text-lg font-semibold text-foreground mb-2">{integration.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{integration.description || 'No description available'}</p>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">{integration.type || 'Custom'}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${integration.status === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                  {integration.status === 'connected' ? '✓ Connected' : 'Available'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Plug className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Need More Integrations?</h3>
            <p className="text-blue-600 dark:text-blue-400 text-sm">
              We&apos;re constantly adding new integrations. Contact our support team to request integration for your favorite tool.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
