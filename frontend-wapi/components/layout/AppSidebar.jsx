"use client";

import {
  FaTimes,
  FaHome,
  FaInbox,
  FaBullhorn,
  FaAddressBook, FaAddressCard,
  FaStore,
  FaHeadset,
  FaCogs,
  FaChartLine,
  FaWhatsapp,
  FaPuzzlePiece,
  FaThLarge,
  FaChevronDown,
  FaShoppingBag,
  FaShoppingCart,
  FaCog,
  FaClipboardList,
  FaClock,
  FaTasks,
  FaEnvelope,
  FaChartBar,
  FaPlusSquare,
  FaBoxOpen,
  FaListAlt,
  FaLock,
  FaUsers,
  FaCode,
  FaMagic
} from "react-icons/fa";
import { useState, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore as useAuth, useFeatureGate } from '@/store/authStore';

const Sidebar = ({ isOpen, onClose, onSectionChange, currentPath }) => {
  const router = useRouter();
  const [openMarket, setOpenMarket] = useState(false);
  const [openSupport, setOpenSupport] = useState(false);
  const [openAutomation, setOpenAutomation] = useState(false);
  const [openSalesCRM, setOpenSalesCRM] = useState(false);
  const [openWhatsAppCommerce, setOpenWhatsAppCommerce] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { 
    user, 
    stage1Complete, 
    loading, 
    canManageTeam, 
    canViewBilling, 
    canAccessAdmin 
  } = useAuth();
  const userRole = user?.role || null;
  const loadingRole = loading;

  // Feature Gates
  const analyticsGate = useFeatureGate('analytics').gate;
  const crmGate = useFeatureGate('crm').gate;
  const automationGate = useFeatureGate('automation').gate;
  const commerceGate = useFeatureGate('commerce').gate;
  const campaignsGate = useFeatureGate('campaigns').gate;
  const templatesGate = useFeatureGate('templates').gate;
  const integrationsGate = useFeatureGate('integrations').gate;
  const widgetGate = useFeatureGate('widget').gate;
  const adsGate = useFeatureGate('ads').gate;
  const inboxGate = useFeatureGate('inbox').gate;
  const contactsGate = useFeatureGate('contacts').gate;
  const teamGate = useFeatureGate('team').gate;
  const billingGate = useFeatureGate('billing').gate;

  const navigate = (path, gate = { allowed: true }) => {
    if (!gate.allowed) {
      // Option A: Shake or show toast
      // Option B: Redirect to billing
      router.push('/dashboard/billing');
      onClose();
      return;
    }
    router.push(path);
    onClose();
  };

  // RBAC helper functions
  const canAccessFeature = (feature) => {
    if (loadingRole) return false;

    const rolePermissions = {
      owner: ['all'],
      admin: ['all'],
      manager: ['templates', 'campaigns', 'messaging', 'contacts', 'automation', 'commerce', 'team'],
      agent: ['inbox', 'messaging', 'contacts'],
      viewer: ['inbox', 'contacts']
    };

    const permissions = rolePermissions[userRole] || [];
    return permissions.includes('all') || permissions.includes(feature);
  };

  const needsPhoneConnection = (feature) => {
    const phoneRequiredFeatures = ['templates', 'campaigns', 'messaging'];
    return phoneRequiredFeatures.includes(feature) && !stage1Complete;
  };

  // Helper function to check if a path is active
  const isActive = (path) => {
    return currentPath === path || currentPath?.startsWith(path + '/');
  };

  // Locked feature indicator
  const LockedIndicator = ({ reason }) => (
    <div className="ml-auto flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
      <FaLock className="text-[10px]" />
      {isHovered && <span className="text-[10px]">{reason}</span>}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Always visible, expands on hover, starts below header */}
      <div
        className={`hidden lg:block fixed top-[60px] left-0 h-[calc(100vh-60px)] bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-gray-200 shadow-2xl z-50 transition-all duration-300 border-r border-gray-200 dark:border-gray-700 ${isHovered ? "w-72" : "w-20"
          }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="p-3 overflow-y-auto h-full custom-scrollbar">
          {/* Home - Dashboard */}
          <div className="mb-6">
            <div
              className={`group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/dashboard') && !currentPath?.includes('/dashboard/')
                ? 'bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white shadow-lg scale-105'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:scale-105 hover:shadow-md'
                }`}
              onClick={() => navigate("/dashboard")}
              title="Dashboard"
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isActive('/dashboard') && !currentPath?.includes('/dashboard/')
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-[#13C18D]/10 to-[#0e8c6c]/10'
                }`}>
                <FaHome className={`text-lg ${isActive('/dashboard') && !currentPath?.includes('/dashboard/') ? 'text-white' : 'text-[#13C18D]'}`} />
              </div>
              {isHovered && (
                <div className="flex-1">
                  <span className="font-semibold text-sm">Dashboard</span>
                  <p className={`text-xs ${isActive('/dashboard') && !currentPath?.includes('/dashboard/') ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>Overview & Stats</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Access Section */}
          {isHovered && (
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3">
                Quick Access
              </p>
            </div>
          )}

          <div
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-2 transition-all duration-200 ${isActive('/dashboard/inbox')
              ? 'bg-gradient-to-r from-[#13C18D]/90 to-[#0e8c6c]/90 text-white shadow-md'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
              } ${!inboxGate.allowed ? 'opacity-70' : ''}`}
            onClick={() => navigate("/dashboard/inbox", inboxGate)}
            title={inboxGate.allowed ? "Inbox" : inboxGate.reason}
          >
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/dashboard/inbox')
              ? 'bg-white/20'
              : 'bg-gradient-to-br from-blue-500/10 to-blue-600/10'
              }`}>
              <FaInbox className={`${isActive('/dashboard/inbox') ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            </div>
            <div className="flex-1 flex items-center justify-between min-w-0">
              {isHovered && <span className={`font-medium text-sm ${isActive('/dashboard/inbox') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Inbox</span>}
              {isHovered && !inboxGate.allowed && <LockedIndicator reason="Upgrade" />}
            </div>
          </div>


          <div
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-2 transition-all duration-200 ${isActive('/dashboard/billing')
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
              }`}
            onClick={() => navigate("/dashboard/billing")}
            title="Billing"
          >
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/dashboard/billing')
              ? 'bg-white/20'
              : 'bg-gradient-to-br from-indigo-500/10 to-indigo-600/10'
              }`}>
              <FaBoxOpen className={`${isActive('/dashboard/billing') ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            </div>
            {isHovered && <span className={`font-medium text-sm ${isActive('/dashboard/billing') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Plan & Billing</span>}
          </div>

          {/* Main Menu Items */}
          <div className="space-y-2">
            <div
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/dashboard/campaign')
                ? 'bg-gradient-to-r from-[#13C18D]/90 to-[#0e8c6c]/90 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
                } ${!campaignsGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => navigate("/dashboard/campaign", campaignsGate)}
              title={campaignsGate.allowed ? "Campaigns" : campaignsGate.reason}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/dashboard/campaign')
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-purple-500/10 to-purple-600/10'
                }`}>
                <FaBullhorn className={`${isActive('/dashboard/campaign') ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
              </div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                {isHovered && <span className={`font-medium text-sm ${isActive('/dashboard/campaign') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Campaigns</span>}
                {isHovered && !campaignsGate.allowed && <LockedIndicator reason="Upgrade" />}
              </div>
            </div>

            <div
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/dashboard/contacts')
                ? 'bg-gradient-to-r from-[#13C18D]/90 to-[#0e8c6c]/90 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
                } ${!contactsGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => navigate("/dashboard/contacts", contactsGate)}
              title={contactsGate.allowed ? "Contacts" : contactsGate.reason}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/dashboard/contacts')
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-orange-500/10 to-orange-600/10'
                }`}>
                <FaAddressBook className={`${isActive('/dashboard/contacts') ? 'text-white' : 'text-orange-600 dark:text-orange-400'}`} />
              </div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                {isHovered && <span className={`font-medium text-sm ${isActive('/dashboard/contacts') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Contacts</span>}
                {isHovered && !contactsGate.allowed && <LockedIndicator reason="Upgrade" />}
              </div>
            </div>

            <div
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/dashboard/ads')
                ? 'bg-gradient-to-r from-[#13C18D]/90 to-[#0e8c6c]/90 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
                } ${!adsGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => navigate("/dashboard/ads", adsGate)}
              title={adsGate.allowed ? "Ads" : adsGate.reason}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/dashboard/ads')
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-teal-500/10 to-teal-600/10'
                }`}>
                <FaChartBar className={`${isActive('/dashboard/ads') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
              </div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                {isHovered && <span className={`font-medium text-sm ${isActive('/dashboard/ads') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Ads</span>}
                {isHovered && !adsGate.allowed && <LockedIndicator reason="Upgrade" />}
              </div>
            </div>

            {/* Market */}
            <div className="mt-6 mb-2">
              {isHovered && (
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3">
                  Features
                </p>
              )}
              <div
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${openMarket
                  ? 'bg-gray-100 dark:bg-gray-700/50'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                onClick={() => setOpenMarket(!openMarket)}
                title="Market"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500/10 to-pink-600/10 flex items-center justify-center">
                    <FaStore className="text-pink-600 dark:text-pink-400" />
                  </div>
                  {isHovered && <span className="text-gray-700 dark:text-gray-200 font-medium text-sm">Market</span>}
                </div>
                {isHovered && (
                  <FaChevronDown
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${openMarket ? "rotate-180" : ""
                      }`}
                  />
                )}
              </div>
            </div>
            {openMarket && isHovered && (
              <div className="ml-6 mb-4 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <div
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${isActive('/dashboard/templates')
                    ? 'bg-[#13C18D]/10 text-[#13C18D] dark:text-[#13C18D] font-medium'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                    } ${!templatesGate.allowed ? 'opacity-70' : ''}`}
                  onClick={() => navigate("/dashboard/templates", templatesGate)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📚</span>
                    <span className="text-sm">Templates & Library</span>
                  </div>
                  {!templatesGate.allowed && <FaLock size={10} className="text-yellow-600" />}
                </div>
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/dashboard/campaign')
                    ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                    } ${!campaignsGate.allowed ? 'opacity-70' : ''}`}
                  onClick={() => navigate("/dashboard/campaign", campaignsGate)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📢</span>
                    <span className="text-sm">Campaigns</span>
                  </div>
                  {!campaignsGate.allowed && <FaLock size={10} className="text-yellow-600" />}
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400 opacity-50"
                  onClick={() => alert('Coming soon!')}
                >
                  <span className="text-lg">🎯</span>
                  <span className="text-sm">Custom Campaign (Pro)</span>
                </div>
              </div>
            )}

            {/* Support */}
            <div
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${openSupport
                ? 'bg-gray-100 dark:bg-gray-700/50'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              onClick={() => setOpenSupport(!openSupport)}
              title="Support"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 flex items-center justify-center">
                  <FaHeadset className="text-cyan-600 dark:text-cyan-400" />
                </div>
                {isHovered && <span className="text-gray-700 dark:text-gray-200 font-medium text-sm">Support</span>}
              </div>
              {isHovered && (
                <FaChevronDown
                  className={`text-gray-400 dark:text-gray-500 transition-transform ${openSupport ? "rotate-180" : ""
                    }`}
                />
              )}
            </div>
            {openSupport && isHovered && (
              <div className="ml-6 mb-4 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <div 
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/dashboard/inbox') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'} ${!inboxGate.allowed ? 'opacity-70' : ''}`} 
                  onClick={() => navigate('/dashboard/inbox', inboxGate)}
                >
                  <div className="flex items-center gap-2">
                    <FaEnvelope className="text-sm" />
                    <span className="text-sm">Inbox</span>
                  </div>
                  {!inboxGate.allowed && <FaLock size={10} className="text-yellow-600" />}
                </div>
                <div 
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/support/chat-analytics') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'} ${!analyticsGate.allowed ? 'opacity-70' : ''}`} 
                  onClick={() => navigate('/support/chat-analytics', analyticsGate)}
                >
                  <div className="flex items-center gap-2">
                    <FaChartBar className="text-sm" />
                    <span className="text-sm">Chat Analytics</span>
                  </div>
                  {!analyticsGate.allowed && <FaLock size={10} className="text-yellow-600" />}
                </div>
                <div 
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/support/chat-assignment') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'} ${!crmGate.allowed ? 'opacity-70' : ''}`} 
                  onClick={() => navigate('/support/chat-assignment', crmGate)}
                >
                  <div className="flex items-center gap-2">
                    <FaPlusSquare className="text-sm" />
                    <span className="text-sm">Chat Assignment</span>
                  </div>
                  {!crmGate.allowed && <FaLock size={10} className="text-yellow-600" />}
                </div>
              </div>
            )}

            {/* Automation */}
            <div
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${openAutomation
                ? 'bg-gray-100 dark:bg-gray-700/50'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                } ${!automationGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => automationGate.allowed ? setOpenAutomation(!openAutomation) : navigate('/dashboard/billing')}
              title={automationGate.allowed ? "Automation & Bots" : automationGate.reason}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10 flex items-center justify-center">
                  <FaPuzzlePiece className="text-purple-600 dark:text-purple-400" />
                </div>
                {isHovered && <span className="text-gray-700 dark:text-gray-200 font-medium text-sm">Automation</span>}
              </div>
              {isHovered && (
                <div className="flex items-center gap-2">
                  {!automationGate.allowed && <LockedIndicator reason="Upgrade" />}
                  <FaChevronDown
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${openAutomation ? "rotate-180" : ""
                      }`}
                  />
                </div>
              )}
            </div>
            {openAutomation && isHovered && (
              <div className="ml-6 mb-4 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation')}>
                  <span className="text-sm">✨ Hub</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation/workflows') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation/workflows')}>
                  <span className="text-sm">⚡ Workflows</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation/auto-replies') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation/auto-replies')}>
                  <span className="text-sm">💬 Auto Replies</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation/instagram-quickflows') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation/instagram-quickflows')}>
                  <span className="text-sm">📸 Instagram Quickflows</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation/whatsapp-forms') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation/whatsapp-forms')}>
                  <span className="text-sm">📋 WhatsApp Forms</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation/interaktive-list') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation/interaktive-list')}>
                  <span className="text-sm">📝 Interaktive List</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation/answerbot') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation/answerbot')}>
                  <span className="text-sm">🤖 Answerbot</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/automation/ai-intent-matching') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/automation/ai-intent-matching')}>
                  <span className="text-sm">✨ AI Intent Match</span>
                </div>
              </div>
            )}

            {/* Sales CRM */}
            <div
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${openSalesCRM
                ? 'bg-gray-100 dark:bg-gray-700/50'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                } ${!crmGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => crmGate.allowed ? setOpenSalesCRM(!openSalesCRM) : navigate('/dashboard/billing')}
              title={crmGate.allowed ? "Sales CRM" : crmGate.reason}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/10 flex items-center justify-center">
                  <FaChartLine className="text-green-600 dark:text-green-400" />
                </div>
                {isHovered && <span className="text-gray-700 dark:text-gray-200 font-medium text-sm">Sales CRM</span>}
              </div>
              {isHovered && (
                <div className="flex items-center gap-2">
                  {!crmGate.allowed && <LockedIndicator reason="Upgrade" />}
                  <FaChevronDown
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${openSalesCRM ? "rotate-180" : ""
                      }`}
                  />
                </div>
              )}
            </div>
            {openSalesCRM && isHovered && (
              <div className="ml-6 mb-4 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/dashboard/contacts') && currentPath.includes('contacts') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/dashboard/contacts')}>
                  <FaClipboardList className="text-sm" />
                  <span className="text-sm">Contacts</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/sales-crm/pipeline') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/sales-crm/pipeline')}>
                  <FaListAlt className="text-sm" />
                  <span className="text-sm">Sales Pipeline</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/sales-crm/reports') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/sales-crm/reports')}>
                  <FaClock className="text-sm" />
                  <span className="text-sm">Reports</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/sales-crm/tasks') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/sales-crm/tasks')}>
                  <FaTasks className="text-sm" />
                  <span className="text-sm">Tasks</span>
                </div>
              </div>
            )}

            {/* WhatsApp Commerce */}
            <div
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${openWhatsAppCommerce
                ? 'bg-gray-100 dark:bg-gray-700/50'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                } ${!commerceGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => commerceGate.allowed ? setOpenWhatsAppCommerce(!openWhatsAppCommerce) : navigate('/dashboard/billing')}
              title={commerceGate.allowed ? "WhatsApp Commerce" : commerceGate.reason}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 flex items-center justify-center">
                  <FaShoppingCart className="text-yellow-600 dark:text-yellow-400" />
                </div>
                {isHovered && (
                  <span className="text-gray-700 dark:text-gray-200 font-medium text-sm">Commerce</span>
                )}
              </div>
              {isHovered && (
                <div className="flex items-center gap-2">
                  {!commerceGate.allowed && <LockedIndicator reason="Upgrade" />}
                  <FaChevronDown
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${openWhatsAppCommerce ? "rotate-180" : ""
                      }`}
                  />
                </div>
              )}
            </div>
            {openWhatsAppCommerce && isHovered && (
              <div className="ml-6 mb-4 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/commerce/settings') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/commerce/settings')}>
                  <FaCog className="text-sm" />
                  <span className="text-sm">Settings</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/commerce/catalog') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/commerce/catalog')}>
                  <FaClipboardList className="text-sm" />
                  <span className="text-sm">Catalog</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/commerce/checkout-bot') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/commerce/checkout-bot')}>
                  <FaClock className="text-sm" />
                  <span className="text-sm">Checkout Bot</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive('/commerce/order-panel') ? 'bg-[#13C18D]/10 text-[#13C18D] font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`} onClick={() => navigate('/commerce/order-panel')}>
                  <FaBoxOpen className="text-sm" />
                  <span className="text-sm">Order Panel</span>
                </div>
              </div>
            )}

            {/* Tools Section */}
            <div className="mt-6 mb-2">
              {isHovered && (
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3">
                  Tools
                </p>
              )}
            </div>

            <div
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/integrations')
                ? 'bg-gradient-to-r from-[#13C18D]/90 to-[#0e8c6c]/90 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
                } ${!integrationsGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => navigate("/integrations", integrationsGate)}
              title={integrationsGate.allowed ? "Integrations" : integrationsGate.reason}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/integrations')
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-red-500/10 to-red-600/10'
                }`}>
                <FaPuzzlePiece className={`${isActive('/integrations') ? 'text-white' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                {isHovered && <span className={`font-medium text-sm ${isActive('/integrations') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Integrations</span>}
                {isHovered && !integrationsGate.allowed && <LockedIndicator reason="Upgrade" />}
              </div>
            </div>

            <div
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/widget')
                ? 'bg-gradient-to-r from-[#13C18D]/90 to-[#0e8c6c]/90 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
                } ${!widgetGate.allowed ? 'opacity-70' : ''}`}
              onClick={() => navigate("/widget", widgetGate)}
              title={widgetGate.allowed ? "Widget" : widgetGate.reason}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/widget')
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-teal-500/10 to-teal-600/10'
                }`}>
                <FaThLarge className={`${isActive('/widget') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
              </div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                {isHovered && <span className={`font-medium text-sm ${isActive('/widget') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Widget</span>}
                {isHovered && !widgetGate.allowed && <LockedIndicator reason="Upgrade" />}
              </div>
            </div>



            {/* Team Management - Now shown to all, but locked based on permissions/plan */}
            {!loadingRole && (
              <div
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/dashboard/settings/teams')
                  ? 'bg-gradient-to-r from-[#13C18D]/90 to-[#0e8c6c]/90 text-white shadow-md'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
                  } ${!teamGate.allowed ? 'opacity-70' : ''}`}
                onClick={() => navigate('/dashboard/settings/teams', teamGate)}
                title={teamGate.allowed ? "Team Management" : teamGate.reason}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/dashboard/settings/teams')
                  ? 'bg-white/20'
                  : 'bg-gradient-to-br from-violet-500/10 to-violet-600/10'
                  }`}>
                  <FaUsers className={`${isActive('/dashboard/settings/teams') ? 'text-white' : 'text-violet-600 dark:text-violet-400'}`} />
                </div>
                <div className="flex-1 flex items-center justify-between min-w-0">
                  {isHovered && <span className={`font-medium text-sm ${isActive('/dashboard/settings/teams') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Team</span>}
                  {isHovered && !teamGate.allowed && <LockedIndicator reason="Upgrade" />}
                </div>
              </div>
            )}

            {/* Admin Dashboard - Now shown to all, but locked based on permissions */}
            {!loadingRole && (
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${isActive('/admin')
                  ? 'bg-teal-700 dark:bg-teal-600 text-white shadow-md'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102 hover:shadow-sm'
                  } ${!canAccessAdmin ? 'opacity-70' : ''}`}
                onClick={() => {
                  if (canAccessAdmin) {
                    navigate('/admin');
                  } else {
                    toast.error('Only the workspace Owner or Admin can access admin settings');
                  }
                }}
                title={canAccessAdmin ? "Admin Dashboard" : "Restricted: Admin Only"}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isActive('/admin')
                  ? 'bg-white/20'
                  : 'bg-gradient-to-br from-indigo-500/10 to-indigo-600/10'
                  }`}>
                  <FaChartBar className={`${isActive('/admin') ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                </div>
                <div className="flex-1 flex items-center justify-between min-w-0">
                  {isHovered && <span className={`font-medium text-sm ${isActive('/admin') ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>Admin</span>}
                  {isHovered && !canAccessAdmin && <LockedIndicator reason="Admin" />}
                </div>
              </div>
            )}

            {/* Admin Plans - Only for admins */}
            {!loadingRole && userRole === 'admin' && (
              <div
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors mt-1 ${isActive('/admin/plans')
                  ? 'bg-blue-700 dark:bg-blue-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                onClick={() => navigate('/admin/plans')}
                title="Manage Plans"
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  <FaThLarge className="text-sm" />
                </div>
                {isHovered && <span className={isActive('/admin/plans') ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>Enterprise Plans</span>}
              </div>
            )}

            {/* Admin WA Requests - Only for admins */}
            {!loadingRole && userRole === 'admin' && (
              <div
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors mt-1 ${isActive('/admin/whatsapp-requests')
                  ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                onClick={() => navigate('/admin/whatsapp-requests')}
                title="WhatsApp Setup Requests"
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-lg">
                  <FaWhatsapp />
                </div>
                {isHovered && <span className={isActive('/admin/whatsapp-requests') ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>WA Setup Requests</span>}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Mobile Sidebar - Slides in from left, starts below header */}
      <div
        className={`lg:hidden fixed top-[60px] left-0 h-[calc(100vh-60px)] w-64 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 transform ${isOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300 z-50 shadow-lg flex flex-col overflow-hidden`}
      >
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Home - Selected */}
          <div className="mb-6">
            <div
              className="flex items-center gap-3 p-2 bg-green-600 text-white rounded cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              <FaHome className="text-white" />
              <span>Home</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Quick Links</p>
            <div
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!inboxGate.allowed ? 'opacity-50' : ''}`}
              onClick={() => navigate('/dashboard/inbox', inboxGate)}
            >
              <div className="flex items-center gap-3">
                <FaInbox className="text-green-500" />
                <span className="text-gray-800">Inbox</span>
              </div>
              {!inboxGate.allowed && <FaLock size={12} className="text-yellow-600" />}
            </div>
          </div>

          {/* Main Menu Items */}
          <div className="space-y-1">
            {/* Campaigns */}
            <div
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!campaignsGate.allowed ? 'opacity-50' : ''}`}
              onClick={() => navigate('/dashboard/campaign', campaignsGate)}
            >
              <div className="flex items-center gap-3">
                <FaBullhorn className="text-green-500" />
                <span className="text-gray-800">Campaigns</span>
              </div>
              {!campaignsGate.allowed && <FaLock size={12} className="text-yellow-600" />}
            </div>

            {/* Contacts */}
            <div
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!contactsGate.allowed ? 'opacity-50' : ''}`}
              onClick={() => navigate('/dashboard/contacts', contactsGate)}
            >
              <div className="flex items-center gap-3">
                <FaAddressBook className="text-green-500" />
                <span className="text-gray-800">Contacts</span>
              </div>
              {!contactsGate.allowed && <FaLock size={12} className="text-yellow-600" />}
            </div>

            {/* Ads */}
            <div
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!adsGate.allowed ? 'opacity-50' : ''}`}
              onClick={() => navigate('/dashboard/ads', adsGate)}
            >
              <div className="flex items-center gap-3">
                <FaChartBar className="text-green-500" />
                <span className="text-gray-800">Ads</span>
              </div>
              {!adsGate.allowed && <FaLock size={12} className="text-yellow-600" />}
            </div>

            {/* Market */}
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => setOpenMarket(!openMarket)}>
              <div className="flex items-center gap-3">
                <FaStore className="text-green-500" />
                <span className="text-gray-800">Market</span>
              </div>
              <FaChevronDown className={`text-gray-500 transition-transform ${openMarket ? "rotate-180" : ""}`} />
            </div>
            {openMarket && (
              <div className="ml-8 mt-1 space-y-1">
                <div
                  className={`flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer text-gray-700 ${!templatesGate.allowed ? 'opacity-50' : ''}`}
                  onClick={() => navigate('/dashboard/templates', templatesGate)}
                >
                  <span>Templates</span>
                  {!templatesGate.allowed && <FaLock size={10} className="text-yellow-600" />}
                </div>
              </div>
            )}

            {/* Support */}
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => setOpenSupport(!openSupport)}>
              <div className="flex items-center gap-3">
                <FaHeadset className="text-green-500" />
                <span className="text-gray-800">Support</span>
              </div>
              <FaChevronDown className={`text-gray-500 transition-transform ${openSupport ? "rotate-180" : ""}`} />
            </div>

            {/* Automation */}
            <div 
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!automationGate.allowed ? 'opacity-50' : ''}`} 
              onClick={() => automationGate.allowed ? setOpenAutomation(!openAutomation) : navigate('/dashboard/billing')}
            >
              <div className="flex items-center gap-3">
                <FaCogs className="text-green-500" />
                <span className="text-gray-800">Automation</span>
              </div>
              <div className="flex items-center gap-2">
                {!automationGate.allowed && <FaLock size={12} className="text-yellow-600" />}
                <FaChevronDown className={`text-gray-500 transition-transform ${openAutomation ? "rotate-180" : ""}`} />
              </div>
            </div>

            {/* Sales CRM */}
            <div 
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!crmGate.allowed ? 'opacity-50' : ''}`} 
              onClick={() => crmGate.allowed ? setOpenSalesCRM(!openSalesCRM) : navigate('/dashboard/billing')}
            >
              <div className="flex items-center gap-3">
                <FaChartLine className="text-green-500" />
                <span className="text-gray-800">Sales CRM</span>
              </div>
              <div className="flex items-center gap-2">
                {!crmGate.allowed && <FaLock size={12} className="text-yellow-600" />}
                <FaChevronDown className={`text-gray-500 transition-transform ${openSalesCRM ? "rotate-180" : ""}`} />
              </div>
            </div>

            {/* WhatsApp Commerce */}
            <div 
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!commerceGate.allowed ? 'opacity-50' : ''}`} 
              onClick={() => commerceGate.allowed ? setOpenWhatsAppCommerce(!openWhatsAppCommerce) : navigate('/dashboard/billing')}
            >
              <div className="flex items-center gap-3">
                <FaShoppingCart className="text-green-500" />
                <span className="text-gray-800">WhatsApp Commerce</span>
              </div>
              <div className="flex items-center gap-2">
                {!commerceGate.allowed && <FaLock size={12} className="text-yellow-600" />}
                <FaChevronDown className={`text-gray-500 transition-transform ${openWhatsAppCommerce ? "rotate-180" : ""}`} />
              </div>
            </div>

            <div
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!integrationsGate.allowed ? 'opacity-50' : ''}`}
              onClick={() => navigate('/integrations', integrationsGate)}
            >
              <div className="flex items-center gap-3">
                <FaPuzzlePiece className="text-green-500" />
                <span className="text-gray-800">Integrations</span>
              </div>
              {!integrationsGate.allowed && <FaLock size={12} className="text-yellow-600" />}
            </div>

            {/* Widget */}
            <div
              className={`flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer ${!widgetGate.allowed ? 'opacity-50' : ''}`}
              onClick={() => navigate('/widget', widgetGate)}
            >
              <div className="flex items-center gap-3">
                <FaThLarge className="text-green-500" />
                <span className="text-gray-800">Widget</span>
              </div>
              {!widgetGate.allowed && <FaLock size={12} className="text-yellow-600" />}
            </div>

            {/* Admin Dashboard - Only for owners */}
            {!loadingRole && userRole === 'admin' && (
              <div
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                onClick={() => navigate('/admin')}
              >
                <span className="text-lg">⚙️</span>
                <span className="text-gray-800">Admin Dashboard</span>
              </div>
            )}

            {/* Settings */}
            <div
              className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
              onClick={() => navigate('/dashboard/settings')}
            >
              <FaCogs className="text-green-500" />
              <span className="text-gray-800">Settings</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(Sidebar);

// Add custom scrollbar styling
if (typeof document !== 'undefined') {
  const style = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(156, 163, 175, 0.5);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(156, 163, 175, 0.7);
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(75, 85, 99, 0.5);
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(75, 85, 99, 0.7);
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.innerHTML = style;
  document.head.appendChild(styleEl);
}