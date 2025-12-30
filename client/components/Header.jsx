'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaBell, FaQuestionCircle, FaWhatsapp, FaUserCircle, FaInstagram, FaComments, FaKey, FaUsers, FaTags, FaReply, FaUser, FaCog, FaPhone, FaCalendar, FaTools, FaSignOutAlt, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import * as api from '@/lib/api';

const Header = () => {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountSummary, setShowAccountSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationTab, setNotificationTab] = useState('unread');
  const [userData, setUserData] = useState(null);
  const [workspaceData, setWorkspaceData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  
  const notifRef = useRef(null);
  const accountRef = useRef(null);
  const settingsRef = useRef(null);

  // Fetch user and workspace data
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await api.get('/auth/me');
      setUserData(response.user);
      setWorkspaceData(response.workspace);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  // Refresh verification status from backend
  const refreshVerificationStatus = async () => {
    try {
      setVerificationLoading(true);
      const response = await api.getVerificationStatus();
      if (response.workspace) {
        setWorkspaceData(prev => ({
          ...prev,
          verification: response.workspace.verification
        }));
      }
    } catch (error) {
      console.error('Failed to refresh verification status:', error);
    } finally {
      setVerificationLoading(false);
    }
  };

  // Close dropdowns when clicking outside
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
    localStorage.removeItem('token');
    localStorage.removeItem('workspace');
    // Dispatch custom event to notify other components of logout
    window.dispatchEvent(new Event('authChange'));
    router.push('/auth/login');
  };

  const handleSettingsClick = (path) => {
    setShowSettings(false);
    router.push(path);
  };

  const formatPlanExpiry = () => {
    if (workspaceData?.subscription?.endDate) {
      const date = new Date(workspaceData.subscription.endDate);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Default to 30 days from now for free trial
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    return defaultExpiry.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getInitials = () => {
    if (!userData?.name) return 'U';
    return userData.name.charAt(0).toUpperCase();
  };

  const formatPhoneNumber = () => {
    // First check if fully connected with actual phone number
    if (workspaceData?.whatsapp?.phoneNumber) {
      const phone = workspaceData.whatsapp.phoneNumber;
      // Format as +91 98765 43210
      if (phone.length >= 10) {
        const countryCode = phone.slice(0, phone.length - 10);
        const firstPart = phone.slice(-10, -5);
        const secondPart = phone.slice(-5);
        return `+${countryCode} ${firstPart} ${secondPart}`;
      }
      return `+${phone}`;
    }
    // Check if there's a requested number in setup
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
    if (!workspaceData?.whatsapp?.isConnected) return 'Not Connected';
    return 'Connected';
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
      return { icon: FaCheckCircle, color: 'text-green-500', label: 'Verified' };
    }
    if (status === 'pending' || status === 'in_review') {
      return { icon: FaExclamationCircle, color: 'text-yellow-500', label: 'Pending' };
    }
    return null;
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
      {/* Left - Logo */}
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-teal-600 rounded flex items-center justify-center">
          <FaWhatsapp className="text-white text-lg" />
        </div>
        <span className="font-bold text-lg text-gray-900 dark:text-white">Interakt</span>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center space-x-4">
        {/* Notification Icon */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowAccountSummary(false);
              setShowSettings(false);
            }}
            className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <FaBell className="text-gray-600 dark:text-gray-300 text-lg" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Notifications</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNotificationTab('all')}
                    className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                      notificationTab === 'all'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setNotificationTab('unread')}
                    className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                      notificationTab === 'unread'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-2 border-teal-600'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setNotificationTab('announcements')}
                    className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                      notificationTab === 'announcements'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Announcements
                  </button>
                </div>
              </div>
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                You dont have any notifications yet
              </div>
            </div>
          )}
        </div>

        {/* Help Icon */}
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
          <FaQuestionCircle className="text-gray-600 dark:text-gray-300 text-lg" />
        </button>

        {/* Settings Icon */}
        <div className="relative" ref={settingsRef}>
          <button 
            onClick={() => {
              setShowSettings(!showSettings);
              setShowNotifications(false);
              setShowAccountSummary(false);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Settings Dropdown */}
          {showSettings && (
            <div className="absolute right-0 mt-2 w-[420px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden p-4">
              <div className="grid grid-cols-2 gap-3">
                {/* WhatsApp Profile */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/whatsapp-profile')}
                  className="flex flex-col items-start p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-2">
                    <FaUser className="text-purple-600 dark:text-purple-400 text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp Profile</span>
                </button>

                {/* Developer Settings */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/developer')}
                  className="flex flex-col items-start p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-2">
                    <FaTools className="text-blue-600 dark:text-blue-400 text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Developer Settings</span>
                </button>

                {/* Contact Settings */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/contacts')}
                  className="flex flex-col items-start p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Contact Settings</span>
                </button>

                {/* Agent Settings */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/agents')}
                  className="flex flex-col items-start p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Agent Settings</span>
                </button>

                {/* Role Permissions */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/roles')}
                  className="flex flex-col items-start p-4 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-2">
                    <FaKey className="text-green-600 dark:text-green-400 text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Role Permissions</span>
                </button>

                {/* Manage Teams */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/teams')}
                  className="flex flex-col items-start p-4 rounded-lg bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center mb-2">
                    <FaUsers className="text-pink-600 dark:text-pink-400 text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Manage Teams</span>
                </button>

                {/* Manage Tags */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/tags')}
                  className="flex flex-col items-start p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-2">
                    <FaTags className="text-purple-600 dark:text-purple-400 text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Manage Tags</span>
                </button>

                {/* Quick Replies */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/quick-replies')}
                  className="flex flex-col items-start p-4 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center mb-2">
                    <FaReply className="text-cyan-600 dark:text-cyan-400 text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Quick Replies</span>
                </button>

                {/* Member Profile */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/member-profile')}
                  className="flex flex-col items-start p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Member Profile</span>
                </button>

                {/* Manage Events */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/events')}
                  className="flex flex-col items-start p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-2">
                    <FaCalendar className="text-indigo-600 dark:text-indigo-400 text-lg" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Manage Events</span>
                </button>

                {/* Configure Channels */}
                <button 
                  onClick={() => handleSettingsClick('/dashboard/settings/channels')}
                  className="flex flex-col items-start p-4 rounded-lg bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-sky-600 dark:text-sky-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                      <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Configure Channels</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={accountRef}>
          <button 
            onClick={() => {
              setShowAccountSummary(!showAccountSummary);
              setShowNotifications(false);
              setShowSettings(false);
              // Refresh verification status when opening account summary
              if (!showAccountSummary) {
                refreshVerificationStatus();
              }
            }}
            className="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">{getInitials()}</span>
            </div>
          </button>

          {/* Account Summary Dropdown */}
          {showAccountSummary && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4">
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                  Account Summary
                </div>
                
                {/* Account Card */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">{getInitials()}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-medium block">{userData?.name || userData?.email || 'User'}</span>
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
                      <div className="text-gray-300 text-xs">Expires On {formatPlanExpiry()}</div>
                    </div>
                    <button 
                      onClick={() => router.push('/pricing')}
                      className="bg-white text-gray-900 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-100 transition-colors"
                    >
                      {workspaceData?.plan === 'free' ? 'Start Subscription' : 'Manage Plan'}
                    </button>
                  </div>
                </div>

                {/* Connection Status */}
                <div className="space-y-3 mb-4">
                  {/* WhatsApp Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FaWhatsapp className={`text-lg ${workspaceData?.whatsapp?.isConnected ? 'text-green-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp Number:</div>
                        <div className={`text-sm ${workspaceData?.whatsapp?.isConnected ? 'text-green-600' : 'text-gray-500'}`}>
                          {formatPhoneNumber()}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => router.push('/dashboard/settings/whatsapp-profile')}
                      className="text-teal-600 hover:text-teal-700 text-xl"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </div>

                  {/* Instagram Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FaInstagram className={`text-lg ${workspaceData?.instagram?.isConnected ? 'text-pink-600' : 'text-gray-400'}`} />
                      <span className="text-sm text-gray-900 dark:text-white">
                        Instagram Account: {workspaceData?.instagram?.isConnected ? workspaceData.instagram.accountId : '-'}
                      </span>
                    </div>
                    <button 
                      onClick={() => router.push('/dashboard/settings/instagram')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        workspaceData?.instagram?.isConnected 
                          ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' 
                          : 'bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600'
                      }`}
                    >
                      {workspaceData?.instagram?.isConnected ? 'Manage' : 'Connect'}
                    </button>
                  </div>

                  {/* RCS Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FaComments className="text-gray-400 text-lg" />
                      <span className="text-sm text-gray-900 dark:text-white">RCS Account: -</span>
                    </div>
                    <button 
                      className="bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-3 py-1 rounded text-xs font-medium cursor-not-allowed" 
                      disabled
                      title="Coming Soon"
                    >
                      Coming Soon
                    </button>
                  </div>

                  {/* Verification Status */}
                  {workspaceData?.verification && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        {workspaceData.verification.isVerified ? (
                          <FaCheckCircle className="text-green-500 text-lg" />
                        ) : (
                          <FaExclamationCircle className="text-yellow-500 text-lg" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">Business Status:</div>
                          <div className={`text-xs ${
                            workspaceData.verification.isVerified ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {workspaceData.verification.isVerified ? 'Verified Business' :
                             workspaceData.verification.status === 'pending' ? 'Verification Pending' :
                             workspaceData.verification.status === 'in_review' ? 'Under Review' :
                             'Verification Required'}
                          </div>
                        </div>
                      </div>
                      {!workspaceData.verification.isVerified && workspaceData.verification.status !== 'pending' && workspaceData.verification.status !== 'in_review' && (
                        <button 
                          onClick={() => router.push('/onboarding/business-info')}
                          className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-xs font-medium hover:bg-yellow-200 transition-colors"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Log Out */}
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <FaSignOutAlt />
                  <span className="font-medium">Log Out</span>
                </button>

                {/* Footer Links */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center space-y-1">
                  <a href="/terms" className="block text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Terms And Conditions
                  </a>
                  <a href="/privacy" className="block text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Privacy Policy
                  </a>
                  <div className="text-xs text-gray-400 dark:text-gray-500">Version : 3.112.71</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
