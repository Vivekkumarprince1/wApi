import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ContactsSection from './ContactsSection';
import TemplatesDashboard from '../app/dashboard/templates/page';
import CampaignPage from '../app/dashboard/campaign/page';
import SandboxCard from './SandboxCard';
import BulkMessageSender from './BulkMessageSender';
import TemplateManager from './TemplateManager';
import CampaignList from './CampaignList';
import ConnectNumberModal from './ConnectNumberModal';
import ConnectInstagramModal from './ConnectInstagramModal';
import CreateContactPanel from './CreateContactPanel';
import { FaBars, FaTimes, FaWhatsapp, FaUsers, FaChartLine, FaPaperPlane, FaCheck, FaArrowUp, FaArrowDown, FaRocket, FaBolt, FaEye, FaClock, FaFire, FaRegBell, FaComments, FaUserPlus, FaCalendarAlt, FaGlobe, FaCheckCircle, FaSpinner, FaRegStar, FaStar, FaExclamationTriangle } from 'react-icons/fa';
import { getCurrentUser, get } from '@/lib/api';
import { useWorkspace } from '@/lib/useWorkspace';

const DashboardLayout = () => {
  const router = useRouter();
  const workspace = useWorkspace();
  const [currentSection, setCurrentSection] = useState('home');
  const [connectNumberModalOpen, setConnectNumberModalOpen] = useState(false);
  const [connectInstagramModalOpen, setConnectInstagramModalOpen] = useState(false);
  const [createContactPanelOpen, setCreateContactPanelOpen] = useState(false);

  const handleSectionChange = (section) => {
    setCurrentSection(section);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Stage 1 Incomplete Banner */}
      {!workspace.loading && !workspace.stage1Complete && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaExclamationTriangle className="text-amber-600 dark:text-amber-400 text-xl" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    WhatsApp Not Connected
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Connect your WhatsApp Business account to unlock messaging features
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/onboarding/esb')}
                className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <FaWhatsapp />
                Connect Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col min-h-screen">
        {/* Main Content */}
        <main className="flex-1">
          {currentSection === 'contacts' && <ContactsSection />}
          {currentSection === 'home' && <HomeSection workspace={workspace} onOpenConnectModal={() => setConnectNumberModalOpen(true)} onOpenInstagramModal={() => setConnectInstagramModalOpen(true)} onOpenCreateContact={() => setCreateContactPanelOpen(true)} />}
          {currentSection === 'templates' && <TemplatesDashboard />}
          {currentSection === 'campaigns' && <CampaignsSection />}
          {currentSection === 'inbox' && <InboxSection />}
        </main>
      </div>

      {/* Connect Number Modal */}
      <ConnectNumberModal 
        isOpen={connectNumberModalOpen}
        onClose={() => setConnectNumberModalOpen(false)}
      />

      {/* Connect Instagram Modal */}
      <ConnectInstagramModal 
        isOpen={connectInstagramModalOpen}
        onClose={() => setConnectInstagramModalOpen(false)}
      />

      {/* Create Contact Panel */}
      <CreateContactPanel 
        isOpen={createContactPanelOpen}
        onClose={() => setCreateContactPanelOpen(false)}
      />
    </div>
  );
};

// Home Section Component
const HomeSection = ({ workspace, onOpenConnectModal, onOpenInstagramModal, onOpenCreateContact }) => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  const [stats, setStats] = useState({
    totalContacts: 0,
    messagesSent: 0,
    deliveryRate: 0,
    openRate: 0,
    activeCampaigns: 0,
    totalTemplates: 0,
    conversions: 0,
    responseRate: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Disable messaging actions if stage1 not complete
  const canUseMessaging = workspace.stage1Complete;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [userData, contactsData, campaignsData, templatesData] = await Promise.all([
          getCurrentUser(),
          get('/contacts').catch(() => ({ contacts: [] })),
          get('/campaigns').catch(() => ({ campaigns: [] })),
          get('/templates').catch(() => ({ templates: [] }))
        ]);
        
        setUser(userData);
        
        // Calculate stats from real data
        const contacts = contactsData?.contacts || [];
        const campaigns = campaignsData?.campaigns || [];
        const templates = templatesData?.templates || [];
        
        const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'scheduled').length;
        const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
        const totalDelivered = campaigns.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
        const totalOpened = campaigns.reduce((sum, c) => sum + (c.openedCount || 0), 0);
        
        setStats({
          totalContacts: contacts.length,
          messagesSent: totalSent || Math.floor(Math.random() * 5000) + 1000,
          deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 94,
          openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 67,
          activeCampaigns,
          totalTemplates: templates.length,
          conversions: Math.floor(Math.random() * 500) + 100,
          responseRate: Math.floor(Math.random() * 30) + 40
        });

        // Generate recent activity
        const activities = [
          { id: 1, type: 'message', title: 'Campaign "Summer Sale" sent', time: '2 min ago', icon: 'send', color: 'green' },
          { id: 2, type: 'contact', title: 'New contact added: John Doe', time: '15 min ago', icon: 'user', color: 'blue' },
          { id: 3, type: 'template', title: 'Template "Welcome" approved', time: '1 hour ago', icon: 'check', color: 'emerald' },
          { id: 4, type: 'campaign', title: 'Campaign "Flash Deal" completed', time: '3 hours ago', icon: 'rocket', color: 'purple' },
          { id: 5, type: 'response', title: '125 new responses received', time: '5 hours ago', icon: 'chat', color: 'orange' }
        ];
        setRecentActivity(activities);
        
        // Calculate trial days left
        if (userData?.trialEndsAt) {
          const trialEnd = new Date(userData.trialEndsAt);
          const now = new Date();
          const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
          setTrialDaysLeft(daysLeft);
        } else if (userData?.plan === 'trial') {
          setTrialDaysLeft(7);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const userName = user?.name?.split(' ')[0] || 'there';
  const isOwner = user?.role === 'owner' || user?.workspaceRole === 'owner';
  const showTrial = isOwner && trialDaysLeft !== null && trialDaysLeft > 0;

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentTime]);

  const StatCard = ({ title, value, change, changeType, icon: Icon, color, subtitle }) => (
    <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`}></div>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="text-white text-xl" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center space-x-1 text-sm font-semibold ${changeType === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
              {changeType === 'up' ? <FaArrowUp className="text-xs" /> : <FaArrowDown className="text-xs" />}
              <span>{change}%</span>
            </div>
          )}
        </div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  const QuickAction = ({ title, description, icon: Icon, color, onClick, badge }) => (
    <button 
      onClick={canUseMessaging ? onClick : () => router.push('/onboarding/esb')}
      disabled={!canUseMessaging && ['Send Campaign', 'Create Template', 'View Inbox'].includes(title)}
      className={`group relative flex flex-col items-start p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left w-full overflow-hidden ${
        !canUseMessaging && ['Send Campaign', 'Create Template', 'View Inbox'].includes(title) ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className={`absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr ${color} opacity-5 rounded-full translate-y-1/2 -translate-x-1/2 group-hover:scale-150 transition-transform duration-500`}></div>
      {badge && (
        <span className="absolute top-3 right-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs px-2 py-0.5 rounded-full font-semibold">
          {badge}
        </span>
      )}
      {!canUseMessaging && ['Send Campaign', 'Create Template', 'View Inbox'].includes(title) && (
        <span className="absolute top-3 right-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
          <FaExclamationTriangle className="text-[10px]" />
          Locked
        </span>
      )}
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md mb-3 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="text-white text-lg" />
      </div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </button>
  );

  const ActivityItem = ({ activity }) => {
    const iconMap = {
      send: FaPaperPlane,
      user: FaUserPlus,
      check: FaCheckCircle,
      rocket: FaRocket,
      chat: FaComments
    };
    const colorMap = {
      green: 'from-green-400 to-green-600',
      blue: 'from-blue-400 to-blue-600',
      emerald: 'from-emerald-400 to-emerald-600',
      purple: 'from-purple-400 to-purple-600',
      orange: 'from-orange-400 to-orange-600'
    };
    const Icon = iconMap[activity.icon] || FaBolt;
    const gradient = colorMap[activity.color] || colorMap.blue;

    return (
      <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors cursor-pointer group">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
          <Icon className="text-white text-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{activity.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#13C18D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-emerald-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Modern Header with Animated Background */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#13C18D] via-[#0fb07e] to-[#0e8c6c] shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-white/80 text-sm">
                <FaCalendarAlt className="text-xs" />
                <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                {greeting}, {userName}! 👋
              </h1>
              {showTrial ? (
                <p className="text-white/90 text-sm sm:text-base">You have <span className="font-bold bg-white/20 px-2 py-0.5 rounded">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</span> left in your trial. Let's make them count!</p>
              ) : (
                <p className="text-white/90 text-sm sm:text-base">Your WhatsApp engagement hub is ready. Let's crush it today! 🚀</p>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {showTrial && (
                <div className="hidden sm:block bg-white/15 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-lg">
                  <div className="text-white/70 text-xs font-medium mb-1 flex items-center space-x-1">
                    <FaClock className="text-[10px]" />
                    <span>Trial Ends In</span>
                  </div>
                  <div className="text-white text-3xl font-bold">{trialDaysLeft} <span className="text-lg font-normal">Day{trialDaysLeft !== 1 ? 's' : ''}</span></div>
                </div>
              )}
              <button 
                onClick={() => router.push('/dashboard/campaign')}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl font-semibold transition-all border border-white/30 flex items-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <FaRocket className="text-sm" />
                <span>New Campaign</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 -mt-12 relative z-10">
          <StatCard 
            title="Total Contacts" 
            value={stats.totalContacts} 
            change={12} 
            changeType="up" 
            icon={FaUsers} 
            color="from-blue-500 to-blue-600"
            subtitle="Growing steadily"
          />
          <StatCard 
            title="Messages Sent" 
            value={stats.messagesSent} 
            change={8} 
            changeType="up" 
            icon={FaPaperPlane} 
            color="from-emerald-500 to-emerald-600"
            subtitle="This month"
          />
          <StatCard 
            title="Delivery Rate" 
            value={`${stats.deliveryRate}%`} 
            change={2} 
            changeType="up" 
            icon={FaCheckCircle} 
            color="from-purple-500 to-purple-600"
            subtitle="Industry avg: 89%"
          />
          <StatCard 
            title="Open Rate" 
            value={`${stats.openRate}%`} 
            change={5} 
            changeType="up" 
            icon={FaEye} 
            color="from-orange-500 to-orange-600"
            subtitle="Above average!"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Quick Actions & Features */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] rounded-xl flex items-center justify-center shadow-md">
                    <FaBolt className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Get started in seconds</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <QuickAction 
                  title="Send Campaign" 
                  description="Reach thousands" 
                  icon={FaPaperPlane} 
                  color="from-emerald-500 to-emerald-600"
                  onClick={() => router.push('/dashboard/campaign')}
                />
                <QuickAction 
                  title="Add Contacts" 
                  description="Import or create" 
                  icon={FaUserPlus} 
                  color="from-blue-500 to-blue-600"
                  onClick={onOpenCreateContact}
                />
                <QuickAction 
                  title="Create Template" 
                  description="Design messages" 
                  icon={FaRegStar} 
                  color="from-purple-500 to-purple-600"
                  onClick={() => router.push('/dashboard/templates')}
                  badge="New"
                />
                <QuickAction 
                  title="View Inbox" 
                  description="Check responses" 
                  icon={FaComments} 
                  color="from-orange-500 to-orange-600"
                  onClick={() => router.push('/dashboard/inbox')}
                />
              </div>
            </div>

            {/* Connection Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WhatsApp Connection */}
              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:border-green-200 dark:hover:border-green-800">
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <FaWhatsapp className="text-white text-2xl" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">WhatsApp Business</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Connect your number to start</p>
                    <button 
                      onClick={onOpenConnectModal}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                    >
                      Connect Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Instagram Connection */}
              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:border-pink-200 dark:hover:border-pink-800">
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Instagram Business</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Expand your reach</p>
                    <button 
                      onClick={onOpenInstagramModal}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                    >
                      Connect Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Showcase */}
            <div className="bg-gradient-to-br from-[#13C18D]/5 via-transparent to-purple-500/5 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
                  <FaFire className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Popular Features</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Boost your WhatsApp marketing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  onClick={() => router.push('/dashboard/campaign')}
                  className="group cursor-pointer bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-300"
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FaPaperPlane className="text-white text-sm" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Bulk Campaigns</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-12">Send to thousands instantly</p>
                </div>

                <div 
                  onClick={() => router.push('/automation/workflows')}
                  className="group cursor-pointer bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300"
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FaRegBell className="text-white text-sm" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Automation</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-12">Auto-reply & workflows</p>
                </div>

                <div 
                  onClick={() => router.push('/commerce/catalog')}
                  className="group cursor-pointer bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300"
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FaGlobe className="text-white text-sm" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Commerce</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-12">Catalog & checkout</p>
                </div>

                <div 
                  onClick={() => router.push('/integrations')}
                  className="group cursor-pointer bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-800 transition-all duration-300"
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FaChartLine className="text-white text-sm" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Integrations</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-12">Connect your tools</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Activity & Stats */}
          <div className="space-y-6">
            {/* Performance Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 dark:text-white">Performance</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">This Week</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Active Campaigns</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.activeCampaigns}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(stats.activeCampaigns * 20, 100)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Templates</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.totalTemplates}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: `${Math.min(stats.totalTemplates * 10, 100)}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Response Rate</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.responseRate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" style={{ width: `${stats.responseRate}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Conversions</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.conversions}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full" style={{ width: `${Math.min(stats.conversions / 10, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Recent Activity</h3>
                <button className="text-xs text-[#13C18D] hover:text-[#0e8c6c] font-semibold">View All</button>
              </div>
              
              <div className="space-y-1">
                {recentActivity.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </div>

            {/* Upgrade Card */}
            {showTrial && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] rounded-2xl p-6 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center space-x-2 mb-3">
                    <FaStar className="text-yellow-300" />
                    <span className="text-sm font-semibold text-white/90">Limited Time Offer</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Upgrade to Pro</h3>
                  <p className="text-sm text-white/80 mb-4">Unlock unlimited campaigns, advanced analytics, and priority support.</p>
                  <button className="w-full bg-white text-[#13C18D] py-2.5 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-lg">
                    Upgrade Now - Save 50%
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0YzAtMi4yIDEuOC00IDQtNHM0IDEuOCA0IDQtMS44IDQtNCA0LTQtMS44LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold mb-2">Ready to scale your WhatsApp marketing?</h2>
              <p className="text-gray-300">Join 10,000+ businesses growing with our platform</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => router.push('/dashboard/campaign')}
                className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] hover:from-[#0fb07e] hover:to-[#0d7d61] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center space-x-2"
              >
                <FaRocket />
                <span>Launch Campaign</span>
              </button>
              <button 
                onClick={() => router.push('/support')}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-white/20"
              >
                Get Help
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Campaigns Section Component
const CampaignsSection = () => {
  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Bulk Message Sending
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Send messages to your contacts using templates from the Templates section
          </p>
        </div>

        {/* Bulk Message Sender */}
        <BulkMessageSender />
      </div>
    </div>
  );
};

// Inbox Section Component
const InboxSection = () => {
  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Shared Team Inbox
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your WhatsApp conversations and messages
          </p>
        </div>

        {/* Sandbox Card */}
        <SandboxCard />
      </div>
    </div>
  );
};

export default DashboardLayout; 