"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Rocket, 
  Loader2, 
  Zap, 
  User, 
  MessageSquare, 
  Settings, 
  Plus, 
  Trash, 
  Send, 
  FileUp, 
  FileDown,
  Activity,
  AlertCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardOverview, getMessageMetrics } from '@/lib/api/analytics';
import { useAuthStore } from '@/store/auth-store';
import FlashLoader from '@/components/ui/flash-loader';

// Modular Home Components
import WelcomeHero from '@/components/dashboard/welcome-hero';
import StatsGrid from '@/components/dashboard/stats-grid';
import QuickActions from '@/components/dashboard/quick-actions';
import ConnectionCards from '@/components/dashboard/connection-cards';
import FeatureShowcase from '@/components/dashboard/feature-showcase';

// Modals
import ConnectNumberModal from '@/components/modals/connect-number-modal';
import ConnectInstagramModal from '@/components/modals/connect-instagram-modal';
import CreateContactPanel from '@/components/modals/create-contact-panel';

const DashboardPageClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, workspace } = useAuthStore();

  const [connectNumberModalOpen, setConnectNumberModalOpen] = useState(false);
  const [connectInstagramModalOpen, setConnectInstagramModalOpen] = useState(false);
  const [createContactPanelOpen, setCreateContactPanelOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const activePhoneStatuses = ['CONNECTED', 'RESTRICTED', 'LIVE', 'ACTIVE', 'VERIFIED'];

  const callbackPayload = useMemo(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (!code && !state && !error && !message) return null;

    return {
      code: code || undefined,
      state: state || undefined,
      error: error || undefined,
      message: message || undefined,
    };
  }, [searchParams]);

  const stage1Complete = workspace?.stage1?.complete || false;
  const phoneStatus = workspace?.stage1?.details?.phoneStatus || workspace?.phoneStatus;
  const isWhatsAppConnected = stage1Complete || activePhoneStatuses.includes(String(phoneStatus || '').toUpperCase());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const shouldOpenConnect = searchParams.get('connectWhatsApp') === '1' || !!callbackPayload;

    // Automatically open if provisioning just finished
    const provisioningJustFinished = onboardingStatus === 'COMPLETED' && !isWhatsAppConnected;

    if (!shouldOpenConnect && !provisioningJustFinished) return;

    if (isWhatsAppConnected && !callbackPayload?.error) {
      router.replace('/');
      return;
    }

    setConnectNumberModalOpen(true);
  }, [searchParams, callbackPayload, isWhatsAppConnected, router]);

  const handleCloseConnectModal = () => {
    setConnectNumberModalOpen(false);
    if (
      searchParams.get('connectWhatsApp') === '1' ||
      searchParams.get('code') ||
      searchParams.get('state') ||
      searchParams.get('error') ||
      searchParams.get('message')
    ) {
      router.replace('/');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboardOverview'],
    queryFn: async () => {
      const [response, messageMetrics] = await Promise.all([
        getDashboardOverview().catch(() => null),
        getMessageMetrics(7).catch(() => null)
      ]);

      const overview = response;
      const health = messageMetrics?.deliveryHealth || null;

      let stats = {
        totalContacts: 0, messagesSent: 0, deliveryRate: 0, openRate: 0,
        activeCampaigns: 0, totalTemplates: 0, conversions: 0, responseRate: 0
      };
      let recentActivity = [];

      if (overview) {
        stats = {
          totalContacts: overview.totalContacts || overview.contacts?.total || 0,
          messagesSent: overview.messages?.totalOutbound || 0,
          deliveryRate: Math.round((overview.messages?.deliveryRate || 0) * 100) / 100,
          openRate: Math.round((overview.messages?.readRate || 0) * 100) / 100,
          activeCampaigns: overview.activeCampaigns || 0,
          totalTemplates: overview.totalTemplates || 0,
          conversions: overview.conversations?.resolved || 0,
          responseRate: Math.round((overview.campaigns?.replyRate || 0) * 100) / 100
        };

        if (overview.recentActivity && Array.isArray(overview.recentActivity)) {
          recentActivity = overview.recentActivity.map((activity: any) => {
            const rawTime = activity.time || activity.timestamp || activity.createdAt;
            return {
              ...activity,
              time: formatTimeAgo(rawTime) || 'Recently',
              title: activity.title || `System ${activity.action || 'Activity'}`
            };
          });
        }
      }

      return { stats, health, recentActivity };
    }
  });

  const stats = dashboardData?.stats || {
    totalContacts: 0, messagesSent: 0, deliveryRate: 0, openRate: 0,
    activeCampaigns: 0, totalTemplates: 0, conversions: 0, responseRate: 0
  };
  const recentActivity = dashboardData?.recentActivity || [];

  const userName = user?.name?.split(' ')[0] || 'there';
  const trialDaysLeft = user?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - currentTime.getTime()) / 86400000))
    : null;
  const showTrial = user?.role === 'owner' && trialDaysLeft !== null && trialDaysLeft > 0;

  const onboardingStatus = workspace?.onboardingStatus;
  const isProvisioning = ['PROVISIONING_STARTED', 'APP_ASSIGNED', 'TOKEN_RESOLVED', 'CONTACTS_SET', 'WEBHOOKS_CONFIGURED'].includes(onboardingStatus || '');

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime]);

  if (isLoading) return <FlashLoader />;

  // Provisioning Overlay (Step 1-5 Block)
  if (isProvisioning) {
    const steps = [
      { id: 'APP', label: 'Assigning WhatsApp Instance', done: ['APP_ASSIGNED', 'TOKEN_RESOLVED', 'CONTACTS_SET', 'WEBHOOKS_CONFIGURED'].includes(onboardingStatus!) },
      { id: 'TOKEN', label: 'Securing Access Keys', done: ['TOKEN_RESOLVED', 'CONTACTS_SET', 'WEBHOOKS_CONFIGURED'].includes(onboardingStatus!) },
      { id: 'CONTACTS', label: 'Syncing Business Identity', done: ['CONTACTS_SET', 'WEBHOOKS_CONFIGURED'].includes(onboardingStatus!) },
      { id: 'WEBHOOK', label: 'Configuring Real-time Webhooks', done: onboardingStatus === 'WEBHOOKS_CONFIGURED' }
    ];

    return (
      <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-xl flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-black tracking-tight mb-2">Setting up your workspace</h2>
          <p className="text-muted-foreground text-sm mb-10">We're provisioning your industrial-strength WhatsApp environment. This usually takes less than 10 seconds.</p>

          <div className="space-y-4 text-left max-w-xs mx-auto">
            {steps.map((step) => (
              <div key={step.id} className={`flex items-center gap-3 transition-opacity duration-500 ${step.done ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`h-2 w-2 rounded-full ${step.done ? 'bg-primary' : 'bg-muted'}`} />
                <span className="text-sm font-bold">{step.label}</span>
                {step.done && <div className="ml-auto h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center"><Zap className="h-2 w-2 text-primary" /></div>}
              </div>
            ))}
          </div>

          <div className="mt-12 text-[10px] uppercase tracking-widest font-black text-muted-foreground/50">
            Industrial Messaging Platform • v3
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <WelcomeHero
        currentTime={currentTime}
        greeting={greeting}
        userName={userName}
        showTrial={showTrial}
        trialDaysLeft={trialDaysLeft}
      />

      <StatsGrid stats={stats} />

      <div className="space-y-6 mb-8">
        <QuickActions
          canUseMessaging={isWhatsAppConnected}
          onAddContacts={() => setCreateContactPanelOpen(true)}
        />

        <ConnectionCards
          isWhatsAppConnected={isWhatsAppConnected}
          workspace={{ ...workspace, phoneNumber: workspace?.phoneNumber }}
          onConnectWhatsApp={() => setConnectNumberModalOpen(true)}
          onConnectInstagram={() => setConnectInstagramModalOpen(true)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FeatureShowcase />
          <div className="bg-card rounded-[32px] p-8 border border-border/50 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black tracking-tight text-foreground">Recent System Activity</h3>
              <button onClick={() => router.push('/analytics/advanced')} className="text-xs font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity">View Logs</button>
            </div>
            <div className="space-y-4 flex-1">
              {recentActivity.slice(0, 5).map((activity: any, idx: number) => {
                const getIcon = () => {
                  switch(activity.type) {
                    case 'contact': return <User className="h-5 w-5" />;
                    case 'message': return <MessageSquare className="h-5 w-5" />;
                    case 'conversation': return <MessageSquare className="h-5 w-5" />;
                    case 'campaign': return <Rocket className="h-5 w-5" />;
                    case 'automation': return <Zap className="h-5 w-5" />;
                    case 'settings': return <Settings className="h-5 w-5" />;
                    default: 
                      if (activity.action === 'create') return <Plus className="h-5 w-5" />;
                      if (activity.action === 'delete') return <Trash className="h-5 w-5" />;
                      if (activity.action === 'send') return <Send className="h-5 w-5" />;
                      if (activity.action === 'import') return <FileUp className="h-5 w-5" />;
                      if (activity.action === 'export') return <FileDown className="h-5 w-5" />;
                      return <Activity className="h-5 w-5" />;
                  }
                };

                const getIconColor = () => {
                  if (activity.status === 'failed') return 'bg-red-500/10 text-red-500';
                  switch(activity.type) {
                    case 'contact': return 'bg-blue-500/10 text-blue-500';
                    case 'message': return 'bg-green-500/10 text-green-500';
                    case 'campaign': return 'bg-purple-500/10 text-purple-500';
                    case 'automation': return 'bg-amber-500/10 text-amber-500';
                    default: return 'bg-primary/10 text-primary';
                  }
                };

                return (
                  <div key={activity.id || idx} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/50 transition-colors group">
                    <div className={`w-10 h-10 rounded-xl ${getIconColor()} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{activity.title || 'System Activity'}</p>
                        {activity.status === 'failed' && <AlertCircle className="h-3 w-3 text-red-500" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium">{activity.time || 'Just now'}</p>
                    </div>
                  </div>
                );
              })}
              {recentActivity.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-40 italic">
                  <p className="text-xs font-medium">No recent activity detected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="group relative overflow-hidden bg-slate-900 dark:bg-slate-800 rounded-3xl p-8 sm:p-10 text-white shadow-premium">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50 transition-transform duration-500 group-hover:scale-110" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Ready to scale your WhatsApp marketing?</h2>
            <p className="text-slate-400 text-base max-w-md">Join businesses growing with our industrial-strength messaging platform.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => router.push('/campaign')}
              className="bg-primary hover:brightness-110 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-xl hover:shadow-primary/20 flex items-center gap-2 group/btn"
            >
              <Rocket className="h-5 w-5 transition-transform group-hover/btn:-translate-y-1 group-hover/btn:translate-x-1" />
              Launch Campaign
            </button>
            <button
              onClick={() => router.push('/support')}
              className="bg-white/5 hover:bg-white/10 text-white px-8 py-3.5 rounded-xl font-bold transition-all border border-white/10 backdrop-blur-md"
            >
              Get Help
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConnectNumberModal isOpen={connectNumberModalOpen} onClose={handleCloseConnectModal} callbackPayload={callbackPayload} />
      <ConnectInstagramModal isOpen={connectInstagramModalOpen} onClose={() => setConnectInstagramModalOpen(false)} />
      <CreateContactPanel isOpen={createContactPanelOpen} onClose={() => setCreateContactPanelOpen(false)} />
    </div>
  );
};

export default DashboardPageClient;
