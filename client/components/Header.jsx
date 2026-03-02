'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  HelpCircle,
  Settings,
  Menu,
  LogOut,
  Trash2,
  ExternalLink,
  User,
  Shield,
  Phone,
  Calendar,
  MessageSquare,
  Users,
  Tag,
  Reply,
  Code,
  Hash,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';

const Header = ({ onMenuClick }) => {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, workspace, logout, phoneStatus, phoneNumber } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountSummary, setShowAccountSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationTab, setNotificationTab] = useState('unread');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verification, setVerification] = useState(null);
  const [waStage1, setWaStage1] = useState(null);
  const [waLoading, setWaLoading] = useState(false);

  // Map auth context to component's expected shape
  const userData = user ? { name: user.name, email: user.email, role: user.role, _id: user.id, emailVerified: user.emailVerified } : null;
  const workspaceData = workspace ? {
    _id: workspace.id,
    name: workspace.name,
    wabaId: workspace.wabaId,
    whatsapp: {
      isConnected: phoneStatus === 'CONNECTED',
      phoneNumber: phoneNumber
    },
    verification,
    plan: user?.plan || 'free',
    subscription: {
      endDate: user?.trialEndsAt
    },
    verification: workspace.verification
  } : null;

  const isWhatsAppConnected = waStage1?.details?.phoneStatus === 'CONNECTED' || waStage1?.checklist?.phoneConnected === true || workspaceData?.whatsapp?.isConnected;
  const whatsappDisplayNumber = waStage1?.details?.phoneNumber || workspaceData?.whatsapp?.phoneNumber;

  const notifRef = useRef(null);
  const accountRef = useRef(null);
  const settingsRef = useRef(null);

  const refreshVerificationStatus = async () => {
    try {
      setVerificationLoading(true);
      const response = await api.getVerificationStatus();
      if (response.workspace) {
        setVerification(response.workspace.verification || null);
      }
    } catch (error) {
      console.error('Failed to refresh verification status:', error);
    } finally {
      setVerificationLoading(false);
    }
  };

  const refreshWhatsAppStatus = async () => {
    try {
      setWaLoading(true);
      const response = await api.bspStage1Status();
      if (response?.stage1) {
        setWaStage1(response.stage1);
      }
    } catch (error) {
      console.error('Failed to refresh WhatsApp status:', error);
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setShowAccountSummary(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleDeleteAccount = async () => {
    const ok = confirm('Are you sure you want to permanently delete your account and all workspace data? This action cannot be undone.');
    if (!ok) return;
    try {
      setLoading(true);
      await api.deleteAccount();
      localStorage.removeItem('token');
      localStorage.removeItem('workspace');
      window.dispatchEvent(new Event('authChange'));
      alert('Your account and workspace data have been deleted.');
      router.push('/');
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert('Failed to delete account. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsClick = (path) => {
    setShowSettings(false);
    router.push(path);
  };

  const closeAll = () => {
    setShowNotifications(false);
    setShowAccountSummary(false);
    setShowSettings(false);
  };

  const formatPlanExpiry = () => {
    if (workspaceData?.subscription?.endDate) {
      const date = new Date(workspaceData.subscription.endDate);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    return defaultExpiry.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getInitials = () => {
    if (!userData?.name) return 'U';
    return userData.name.charAt(0).toUpperCase();
  };

  const formatPhoneNumber = () => {
    if (whatsappDisplayNumber) {
      const phone = whatsappDisplayNumber;
      if (phone.length >= 10) {
        const countryCode = phone.slice(0, phone.length - 10);
        const firstPart = phone.slice(-10, -5);
        const secondPart = phone.slice(-5);
        return `+${countryCode} ${firstPart} ${secondPart}`;
      }
      return `+${phone}`;
    }
    if (workspaceData?.whatsapp?.requestedNumber && workspaceData?.whatsapp?.setupStatus !== 'not_started') {
      const phone = workspaceData.whatsapp.requestedNumber;
      const status = workspaceData.whatsapp.setupStatus;
      const statusLabels = {
        'otp_sent': '(Verifying...)',
        'otp_verified': '(Registering...)',
        'registering': '(Registering...)',
        'pending_activation': '(Pending Activation)',
      };
      return `+${phone.slice(0, 2)} ${phone.slice(2, 7)}** ${statusLabels[status] || ''}`;
    }
    if (!isWhatsAppConnected) return 'Not Connected';
    return 'Connected';
  };

  const handleWhatsAppClick = () => {
    router.push(isWhatsAppConnected ? '/dashboard/settings/whatsapp-profile' : '/onboarding/esb');
  };

  const getPlanName = () => {
    const plan = workspaceData?.plan || 'free';
    const planNames = {
      'free': 'Growth (free trial)',
      'basic': 'Basic',
      'premium': 'Premium',
      'enterprise': 'Enterprise'
    };
    return planNames[plan] || plan;
  };

  const getVerificationBadge = () => {
    if (!workspaceData?.verification) return null;
    const isVerified = workspaceData.verification.isVerified;
    const status = workspaceData.verification.status;

    if (isVerified) {
      return { icon: CheckCircle, color: 'text-emerald-500', label: 'Verified' };
    }
    if (status === 'pending' || status === 'in_review') {
      return { icon: AlertCircle, color: 'text-amber-500', label: 'Pending' };
    }
    return null;
  };

  // Settings grid items
  const settingsItems = [
    { label: 'WhatsApp Profile', path: '/dashboard/settings/whatsapp-profile', icon: User, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { label: 'Developer Settings', path: '/dashboard/settings/developer', icon: Code, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { label: 'Contact Settings', path: '/dashboard/settings/contacts', icon: Phone, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { label: 'Agent Settings', path: '/dashboard/settings/agents', icon: Users, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
    { label: 'Role Permissions', path: '/dashboard/settings/roles', icon: Shield, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: 'Manage Teams', path: '/dashboard/settings/teams', icon: Users, color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
    { label: 'Manage Tags', path: '/dashboard/settings/tags', icon: Tag, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
    { label: 'Quick Replies', path: '/dashboard/settings/quick-replies', icon: Reply, color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
    { label: 'Member Profile', path: '/dashboard/settings/member-profile', icon: User, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { label: 'Manage Events', path: '/dashboard/settings/events', icon: Calendar, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
    { label: 'Configure Channels', path: '/dashboard/settings/channels', icon: MessageSquare, color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[60px] glass-effect border-b border-border/40">
      <div className="flex items-center justify-between h-full px-4 sm:px-6">
        {/* Left - Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-accent rounded-xl transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center shadow-premium shadow-primary/20">
              <FaWhatsapp className="text-white text-[16px]" />
            </div>
            <span className="font-bold text-lg text-foreground hidden sm:block tracking-tight">
              {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}
            </span>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowAccountSummary(false);
                setShowSettings(false);
              }}
              className="relative p-2.5 hover:bg-accent rounded-xl transition-colors group"
            >
              <Bell className="h-[18px] w-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[380px] bg-card rounded-2xl shadow-premium border border-border/50 overflow-hidden animate-fade-in-up">
                <div className="p-4 border-b border-border/50">
                  <h3 className="font-semibold text-foreground mb-3">Notifications</h3>
                  <div className="flex gap-1.5 bg-muted/50 rounded-xl p-1">
                    {['all', 'unread', 'announcements'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setNotificationTab(tab)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${notificationTab === tab
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-10 text-center">
                  <Bell className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 hover:bg-accent rounded-xl transition-colors group"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-[18px] w-[18px] text-amber-400 group-hover:text-amber-300 transition-colors" />
            ) : (
              <Moon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </button>

          {/* Help */}
          <button className="p-2.5 hover:bg-accent rounded-xl transition-colors group">
            <HelpCircle className="h-[18px] w-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Settings Quick Access */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => {
                setShowSettings(!showSettings);
                setShowNotifications(false);
                setShowAccountSummary(false);
              }}
              className="p-2.5 hover:bg-accent rounded-xl transition-colors group"
            >
              <Settings className="h-[18px] w-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-2 w-[420px] bg-card rounded-2xl shadow-premium border border-border/50 overflow-hidden animate-fade-in-up">
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Settings</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {settingsItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => handleSettingsClick(item.path)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/80 transition-all duration-200 group text-left"
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color} transition-colors`}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative ml-1" ref={accountRef}>
            <button
              onClick={() => {
                setShowAccountSummary(!showAccountSummary);
                setShowNotifications(false);
                setShowSettings(false);
                if (!showAccountSummary) {
                  refreshVerificationStatus();
                  refreshWhatsAppStatus();
                }
              }}
              className="flex items-center gap-2 hover:bg-accent px-2 py-1.5 rounded-xl transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                <span className="text-primary-foreground font-semibold text-sm">{getInitials()}</span>
              </div>
            </button>

            {showAccountSummary && (
              <div className="absolute right-0 mt-2 w-[340px] bg-card rounded-2xl shadow-premium border border-border/50 overflow-hidden animate-fade-in-up">
                <div className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Account Summary</p>

                  {/* Account Card */}
                  <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                        <span className="text-white font-bold">{getInitials()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-medium block truncate">{userData?.name || userData?.email || 'User'}</span>
                        {getVerificationBadge() && (
                          <span className={`text-xs flex items-center gap-1 ${getVerificationBadge().color}`}>
                            {React.createElement(getVerificationBadge().icon, { className: 'w-3 h-3' })}
                            {getVerificationBadge().label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">{getPlanName()} Plan</div>
                        <div className="text-slate-300 text-xs">Expires {formatPlanExpiry()}</div>
                      </div>
                      <button
                        onClick={() => router.push('/pricing')}
                        className="bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                      >
                        {workspaceData?.plan === 'free' ? 'Upgrade' : 'Manage'}
                      </button>
                    </div>
                  </div>

                  {/* Connection Status */}
                  <div className="space-y-3 mb-4">
                    {/* WhatsApp */}
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2.5">
                        <FaWhatsapp className={`text-base ${isWhatsAppConnected ? 'text-emerald-500' : 'text-muted-foreground/50'}`} />
                        <div>
                          <div className="text-sm font-medium text-foreground">WhatsApp</div>
                          <div className={`text-xs ${isWhatsAppConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {waLoading ? 'Checking status...' : formatPhoneNumber()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleWhatsAppClick}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Instagram */}
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2.5">
                        <FaInstagram className={`text-base ${workspaceData?.instagram?.isConnected ? 'text-pink-500' : 'text-muted-foreground/50'}`} />
                        <div>
                          <div className="text-sm font-medium text-foreground">Instagram</div>
                          <div className="text-xs text-muted-foreground">
                            {workspaceData?.instagram?.isConnected ? workspaceData.instagram.accountId : 'Not connected'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/dashboard/settings/instagram')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${workspaceData?.instagram?.isConnected
                          ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                      >
                        {workspaceData?.instagram?.isConnected ? 'Manage' : 'Connect'}
                      </button>
                    </div>

                    {/* RCS */}
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="h-4 w-4 text-muted-foreground/50" />
                        <div>
                          <div className="text-sm font-medium text-foreground">RCS</div>
                          <div className="text-xs text-muted-foreground">Not available</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-muted-foreground cursor-not-allowed">
                        Coming Soon
                      </span>
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="space-y-1 border-t border-border/50 pt-3">
                    <button
                      onClick={handleDeleteAccount}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Account</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log Out</span>
                    </button>
                  </div>

                  {/* Footer Links */}
                  <div className="mt-3 pt-3 border-t border-border/50 text-center space-y-1">
                    <a href="/terms" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Terms And Conditions
                    </a>
                    <a href="/privacy" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Privacy Policy
                    </a>
                    <div className="text-xs text-muted-foreground/60 mt-1">Version 3.112.71</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
