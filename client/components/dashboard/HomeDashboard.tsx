"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Send,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Rocket,
  Zap,
  Eye,
  Clock,
  Flame,
  Bell,
  MessageCircle,
  UserPlus,
  Calendar,
  Globe,
  Star,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { get } from '@/lib/api';
import { useWorkspace } from '@/lib/useWorkspace';
import { useAuth } from '@/lib/AuthProvider';
import ConnectNumberModal from '@/components/ConnectNumberModal';
import ConnectInstagramModal from '@/components/ConnectInstagramModal';
import CreateContactPanel from '@/components/CreateContactPanel';

const HomeDashboard = () => {
  const router = useRouter();
  const workspace = useWorkspace();
  const { user: authUser } = useAuth();
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  const [connectNumberModalOpen, setConnectNumberModalOpen] = useState(false);
  const [connectInstagramModalOpen, setConnectInstagramModalOpen] = useState(false);
  const [createContactPanelOpen, setCreateContactPanelOpen] = useState(false);

  const [stats, setStats] = useState({
    totalContacts: 0, messagesSent: 0, deliveryRate: 0, openRate: 0,
    activeCampaigns: 0, totalTemplates: 0, conversions: 0, responseRate: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const canUseMessaging = workspace.stage1Complete;
  const isWhatsAppConnected = workspace.stage1Complete || ['CONNECTED', 'RESTRICTED'].includes(workspace.phoneStatus || '');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Fetch dashboard overview directly
        const response = await get('/analytics/overview').catch((err) => {
          console.error('Failed to fetch analytics:', err);
          return { data: null };
        });
        
        const overview = response?.data;
        
          if (overview) {
            setStats({
              totalContacts: overview.totalContacts || overview.contacts?.total || 0,
              messagesSent: overview.messages?.totalOutbound || 0,
              deliveryRate: overview.messages?.deliveryRate || 0,
              openRate: overview.messages?.readRate || 0,
              activeCampaigns: overview.activeCampaigns || 0,
              totalTemplates: overview.totalTemplates || 0,
              conversions: overview.conversations?.resolved || 0,
              responseRate: overview.campaigns?.replyRate || 0
            });

          if (overview.recentActivity && overview.recentActivity.length > 0) {
            setRecentActivity(overview.recentActivity.map((activity: any) => ({
              ...activity,
              time: formatTimeAgo(activity.time)
            })));
          } else {
            setRecentActivity([]);
          }
        } else {
            // Fallback for empty state or error
             setStats({
                totalContacts: 0, messagesSent: 0, deliveryRate: 0, openRate: 0,
                activeCampaigns: 0, totalTemplates: 0, conversions: 0, responseRate: 0
              });
              setRecentActivity([]);
        }

        if (authUser?.trialEndsAt) {
          const daysLeft = Math.max(0, Math.ceil((new Date(authUser.trialEndsAt).getTime() - Date.now()) / 86400000));
          setTrialDaysLeft(daysLeft as any);
        } else if (authUser?.plan === 'trial') {
          setTrialDaysLeft(7 as any);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

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

  const userName = (authUser as any)?.name?.split(' ')[0] || 'there';
  const isOwner = (authUser as any)?.role === 'owner' || (authUser as any)?.role === 'owner';
  const showTrial = isOwner && trialDaysLeft !== null && (trialDaysLeft as number) > 0;

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime]);

  // ─── Sub-components ─────────────────────────────────────────────────

  const StatCard = ({ title, value, change, changeType, icon: Icon, color, subtitle }: any) => (
    <div className="group relative bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
      <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${color} opacity-[0.07] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="text-white h-5 w-5" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-semibold ${changeType === 'up' ? 'text-emerald-500' : 'text-destructive'}`}>
              {changeType === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{change}%</span>
            </div>
          )}
        </div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        <p className="text-2xl font-bold text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  const QuickAction = ({ title, description, icon: Icon, color, onClick, badge }: any) => {
    const isLockedAction = !canUseMessaging && ['Send Campaign', 'Create Template', 'View Inbox'].includes(title);
    return (
      <button
        onClick={isLockedAction ? () => router.push('/onboarding/esb') : onClick}
        disabled={isLockedAction}
        className={`group relative flex flex-col items-start p-4 bg-card rounded-2xl border border-border/50 hover:shadow-premium transition-all duration-300 hover:-translate-y-0.5 text-left w-full overflow-hidden ${isLockedAction ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className={`absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr ${color} opacity-[0.07] rounded-full translate-y-1/2 -translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
        {badge && (
          <span className="absolute top-2.5 right-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">{badge}</span>
        )}
        {isLockedAction && (
          <span className="absolute top-2.5 right-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> Locked
          </span>
        )}
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md mb-2.5 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="text-white h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-0.5">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </button>
    );
  };

  const ActivityItem = ({ activity }: any) => {
    const iconMap: any = { send: Send, user: UserPlus, check: CheckCircle, rocket: Rocket, chat: MessageCircle };
    const colorMap: any = {
      emerald: 'from-emerald-400 to-emerald-600', blue: 'from-blue-400 to-blue-600',
      violet: 'from-violet-400 to-violet-600', amber: 'from-amber-400 to-amber-600'
    };
    const Icon = iconMap[activity.icon] || Zap;
    const gradient = colorMap[activity.color] || colorMap.blue;

    return (
      <div className="flex items-center gap-3 p-2.5 hover:bg-accent/50 rounded-xl transition-colors cursor-pointer group">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform shrink-0`}>
          <Icon className="text-white h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
          <p className="text-xs text-muted-foreground">{activity.time}</p>
        </div>
      </div>
    );
  };

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
      {/* WhatsApp Not Connected Banner */}
      {!workspace.loading && !workspace.stage1Complete && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">WhatsApp Not Connected</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">Connect your WhatsApp Business account to unlock messaging features</p>
              </div>
            </div>
            <button onClick={() => router.push('/onboarding/esb')}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
              <FaWhatsapp /> Connect Now
            </button>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary via-[#0fb07e] to-primary/80 rounded-2xl mb-8 shadow-premium">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />

        <div className="relative py-8 sm:py-10 px-6 sm:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">{greeting}, {userName}! 👋</h1>
              {showTrial ? (
                <p className="text-white/90 text-sm sm:text-base">You have <span className="font-bold bg-white/20 px-2 py-0.5 rounded">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</span> left in your trial</p>
              ) : (
                <p className="text-white/90 text-sm sm:text-base">Your WhatsApp engagement hub is ready. Let&apos;s crush it today! 🚀</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {showTrial && (
                <div className="hidden sm:block bg-white/15 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/20">
                  <div className="text-white/70 text-xs font-medium mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Trial Ends In</div>
                  <div className="text-white text-2xl font-bold">{trialDaysLeft} <span className="text-sm font-normal">Days</span></div>
                </div>
              )}
              <button onClick={() => router.push('/dashboard/campaign')}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl font-semibold transition-all border border-white/30 flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105">
                <Rocket className="h-4 w-4" /> New Campaign
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - overlapping the hero */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8 -mt-6 relative z-10">
        <StatCard title="Total Contacts" value={stats.totalContacts} change={12} changeType="up" icon={Users} color="from-blue-500 to-blue-600" subtitle="Growing steadily" />
        <StatCard title="Messages Sent" value={stats.messagesSent} change={8} changeType="up" icon={Send} color="from-emerald-500 to-emerald-600" subtitle="This month" />
        <StatCard title="Delivery Rate" value={`${stats.deliveryRate}%`} change={2} changeType="up" icon={CheckCircle} color="from-violet-500 to-violet-600" subtitle="Industry avg: 89%" />
        <StatCard title="Open Rate" value={`${stats.openRate}%`} change={5} changeType="up" icon={Eye} color="from-amber-500 to-amber-600" subtitle="Above average!" />
      </div>

      {/* Main Content — 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left — Quick Actions + Connections + Features */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="bg-card rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md">
                <Zap className="text-white h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Quick Actions</h2>
                <p className="text-xs text-muted-foreground">Get started in seconds</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickAction title="Send Campaign" description="Reach thousands" icon={Send} color="from-emerald-500 to-emerald-600" onClick={() => router.push('/dashboard/campaign')} />
              <QuickAction title="Add Contacts" description="Import or create" icon={UserPlus} color="from-blue-500 to-blue-600" onClick={() => setCreateContactPanelOpen(true)} />
              <QuickAction title="Create Template" description="Design messages" icon={Star} color="from-violet-500 to-violet-600" onClick={() => router.push('/dashboard/templates')} badge="New" />
              <QuickAction title="View Inbox" description="Check responses" icon={MessageCircle} color="from-amber-500 to-amber-600" onClick={() => router.push('/dashboard/inbox')} />
            </div>
          </div>

          {/* Connection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:border-emerald-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <FaWhatsapp className="text-white text-xl" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground mb-1">WhatsApp Business</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {isWhatsAppConnected ? 'Your number is connected' : 'Connect your number to start'}
                  </p>
                  <button
                    onClick={() => !isWhatsAppConnected && setConnectNumberModalOpen(true)}
                    disabled={isWhatsAppConnected}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
                      isWhatsAppConnected
                        ? 'bg-emerald-100 text-emerald-700 cursor-default dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white hover:shadow-lg'
                    }`}
                  >
                    {isWhatsAppConnected ? 'Connected' : 'Connect Now'}
                  </button>
                </div>
              </div>
            </div>

            <div className="group bg-card rounded-2xl p-5 border border-border/50 hover:shadow-premium transition-all duration-300 hover:border-pink-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground mb-1">Instagram Business</h3>
                  <p className="text-xs text-muted-foreground mb-3">Expand your reach</p>
                  <button onClick={() => setConnectInstagramModalOpen(true)}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg">
                    Connect Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Showcase */}
          <div className="bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 rounded-2xl p-5 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
                <Flame className="text-white h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Popular Features</h2>
                <p className="text-xs text-muted-foreground">Boost your WhatsApp marketing</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: 'Bulk Campaigns', desc: 'Send to thousands instantly', icon: Send, color: 'from-emerald-500 to-emerald-600', href: '/dashboard/campaign' },
                { title: 'Automation', desc: 'Auto-reply & workflows', icon: Bell, color: 'from-blue-500 to-blue-600', href: '/automation/workflows' },
                { title: 'Commerce', desc: 'Catalog & checkout', icon: Globe, color: 'from-violet-500 to-violet-600', href: '/commerce/catalog' },
                { title: 'Integrations', desc: 'Connect your tools', icon: TrendingUp, color: 'from-amber-500 to-amber-600', href: '/integrations' },
              ].map(f => (
                <div key={f.title} onClick={() => router.push(f.href)}
                  className="group cursor-pointer bg-card rounded-xl p-4 border border-border/50 hover:shadow-premium hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className={`w-8 h-8 bg-gradient-to-br ${f.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <f.icon className="text-white h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-bold text-foreground text-sm">{f.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground ml-11">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Performance + Activity + Upgrade */}
        <div className="space-y-6">
          {/* Performance Summary */}
          <div className="bg-card rounded-2xl p-5 border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Performance</h3>
              <span className="text-xs text-muted-foreground">This Week</span>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Active Campaigns', value: stats.activeCampaigns, pct: Math.min(stats.activeCampaigns * 20, 100), color: 'from-emerald-500 to-emerald-400' },
                { label: 'Templates', value: stats.totalTemplates, pct: Math.min(stats.totalTemplates * 10, 100), color: 'from-blue-500 to-blue-400' },
                { label: 'Response Rate', value: `${stats.responseRate}%`, pct: stats.responseRate, color: 'from-violet-500 to-violet-400' },
                { label: 'Conversions', value: stats.conversions, pct: Math.min(stats.conversions / 10, 100), color: 'from-amber-500 to-amber-400' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-muted-foreground">{m.label}</span>
                    <span className="text-sm font-bold text-foreground">{m.value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${m.color} rounded-full transition-all duration-700`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-2xl p-5 border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground">Recent Activity</h3>
              <button className="text-xs text-primary hover:text-primary/80 font-semibold">View All</button>
            </div>
            <div className="space-y-0.5">
              {recentActivity.map((activity: any) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          </div>

          {/* Upgrade Card */}
          {showTrial && (
            <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-white shadow-premium">
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-300" />
                  <span className="text-sm font-semibold text-white/90">Limited Time Offer</span>
                </div>
                <h3 className="text-lg font-bold mb-1.5">Upgrade to Pro</h3>
                <p className="text-sm text-white/80 mb-4">Unlimited campaigns, advanced analytics, priority support.</p>
                <button className="w-full bg-white text-primary py-2.5 rounded-xl font-bold hover:bg-white/90 transition-colors shadow-lg">
                  Upgrade Now - Save 50%
                </button>
              </div>
            </div>
          )}
        </div>
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
      <ConnectNumberModal isOpen={connectNumberModalOpen} onClose={() => setConnectNumberModalOpen(false)} />
      <ConnectInstagramModal isOpen={connectInstagramModalOpen} onClose={() => setConnectInstagramModalOpen(false)} />
      <CreateContactPanel isOpen={createContactPanelOpen} onClose={() => setCreateContactPanelOpen(false)} />
    </div>
  );
};

export default HomeDashboard;
