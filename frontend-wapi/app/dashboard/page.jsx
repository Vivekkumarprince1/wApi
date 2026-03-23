"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Rocket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { useAuthStore as useAuth } from '@/store/authStore';
import ConnectNumberModal from '@/components/modals/ConnectNumberModal';
import ConnectInstagramModal from '@/components/modals/ConnectInstagramModal';
import CreateContactPanel from '@/components/modals/CreateContactPanel';

// Modular Home Components
import WelcomeHero from '@/components/dashboard/WelcomeHero';
import StatsGrid from '@/components/dashboard/StatsGrid';
import DeliveryHealth from '@/components/dashboard/DeliveryHealth';
import QuickActions from '@/components/dashboard/QuickActions';
import ConnectionCards from '@/components/dashboard/ConnectionCards';
import FeatureShowcase from '@/components/dashboard/FeatureShowcase';
import RightSidebar from '@/components/dashboard/RightSidebar';

const DashboardPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspace = useAuthStore(state => state.workspace);
  const { user: authUser } = useAuth();
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
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

    if (!code && !state && !error && !message) {
      return null;
    }

    return {
      code: code || undefined,
      state: state || undefined,
      error: error || undefined,
      message: message || undefined,
    };
  }, [searchParams]);

  const canUseMessaging = workspace?.stage1Complete || false;
  const isWhatsAppConnected = workspace?.stage1Complete || activePhoneStatuses.includes(String(workspace?.phoneStatus || '').toUpperCase());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const shouldOpenConnect = searchParams.get('connectWhatsApp') === '1' || !!callbackPayload;

    if (!shouldOpenConnect) return;

    if (isWhatsAppConnected && !callbackPayload?.error) {
      router.replace('/dashboard');
      return;
    }

    setConnectNumberModalOpen(true);
  }, [searchParams, callbackPayload, isWhatsAppConnected, router]);

  const handleCloseConnectModal = () => {
    setConnectNumberModalOpen(false);

    if (
      searchParams.get('connectWhatsApp') === '1'
      || searchParams.get('code')
      || searchParams.get('state')
      || searchParams.get('error')
      || searchParams.get('message')
    ) {
      router.replace('/dashboard');
    }
  };

  const formatTimeAgo = (dateString) => {
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
        api.get('/analytics/dashboard/overview').catch(() => ({ data: null })),
        api.get('/metrics/messages?days=7').catch(() => null)
      ]);

      const overview = response?.data;
      const health = messageMetrics?.deliveryHealth || null;

      let newStats = {
        totalContacts: 0, messagesSent: 0, deliveryRate: 0, openRate: 0,
        activeCampaigns: 0, totalTemplates: 0, conversions: 0, responseRate: 0
      };
      let newRecentActivity = [];

      if (overview) {
        newStats = {
          totalContacts: overview.totalContacts || overview.contacts?.total || 0,
          messagesSent: overview.messages?.totalOutbound || 0,
          deliveryRate: overview.messages?.deliveryRate || 0,
          openRate: overview.messages?.readRate || 0,
          activeCampaigns: overview.activeCampaigns || 0,
          totalTemplates: overview.totalTemplates || 0,
          conversions: overview.conversations?.resolved || 0,
          responseRate: overview.campaigns?.replyRate || 0
        };

        if (overview.recentActivity && overview.recentActivity.length > 0) {
          newRecentActivity = overview.recentActivity.map((activity) => ({
            ...activity,
            time: formatTimeAgo(activity.time)
          }));
        }
      }

      return { stats: newStats, health, recentActivity: newRecentActivity };
    }
  });

  const stats = dashboardData?.stats || {
    totalContacts: 0, messagesSent: 0, deliveryRate: 0, openRate: 0,
    activeCampaigns: 0, totalTemplates: 0, conversions: 0, responseRate: 0
  };
  const deliveryHealth = dashboardData?.health || null;
  const recentActivity = dashboardData?.recentActivity || [];

  useEffect(() => {
    if (authUser?.trialEndsAt) {
      const daysLeft = Math.max(0, Math.ceil((new Date(authUser.trialEndsAt).getTime() - Date.now()) / 86400000));
      setTrialDaysLeft(daysLeft);
    } else if (authUser?.plan === 'trial') {
      setTrialDaysLeft(7);
    }
  }, [authUser]);

  const userName = (authUser)?.name?.split(' ')[0] || 'there';
  const isOwner = (authUser)?.role === 'owner' || (authUser)?.role === 'owner';
  const showTrial = isOwner && trialDaysLeft !== null && trialDaysLeft > 0;

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime]);

  // ─── Loading State ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in-up">
      <WelcomeHero
        currentTime={currentTime}
        greeting={greeting}
        userName={userName}
        showTrial={showTrial}
        trialDaysLeft={trialDaysLeft}
      />

      <StatsGrid stats={stats} />

      {/* Main Content — 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left — Quick Actions + Connections + Features */}
        <div className="lg:col-span-2 space-y-6">
          <DeliveryHealth deliveryHealth={deliveryHealth} />

          <QuickActions
            canUseMessaging={canUseMessaging}
            onAddContacts={() => setCreateContactPanelOpen(true)}
          />

          <ConnectionCards
            isWhatsAppConnected={isWhatsAppConnected}
            workspace={workspace || {}}
            onConnectWhatsApp={() => setConnectNumberModalOpen(true)}
            onConnectInstagram={() => setConnectInstagramModalOpen(true)}
          />

          <FeatureShowcase />
        </div>

        {/* Right — Performance + Activity + Upgrade */}
        <RightSidebar
          stats={stats}
          recentActivity={recentActivity}
          showTrial={showTrial}
        />
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0YzAtMi4yIDEuOC00IDQtNHM0IDEuOCA0IDQtMS44IDQtNCA0LTQtMS44LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="text-center md:text-left">
            <h2 className="text-xl sm:text-2xl font-bold mb-1">Ready to scale your WhatsApp marketing?</h2>
            <p className="text-slate-300 text-sm">Join 10,000+ businesses growing with our platform</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/campaign')}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-[#0fb07e] hover:to-[#0d7d61] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Launch Campaign
            </button>
            <button onClick={() => router.push('/support')}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl font-semibold transition-all border border-white/20">
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

export default DashboardPage;
