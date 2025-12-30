import React, { useState } from 'react';
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
import { FaBars, FaTimes } from 'react-icons/fa';

const DashboardLayout = () => {
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState('home');
  const [connectNumberModalOpen, setConnectNumberModalOpen] = useState(false);
  const [connectInstagramModalOpen, setConnectInstagramModalOpen] = useState(false);
  const [createContactPanelOpen, setCreateContactPanelOpen] = useState(false);

  const handleSectionChange = (section) => {
    setCurrentSection(section);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content Area */}
      <div className="flex flex-col min-h-screen">
        {/* Main Content */}
        <main className="flex-1">
          {currentSection === 'contacts' && <ContactsSection />}
          {currentSection === 'home' && <HomeSection onOpenConnectModal={() => setConnectNumberModalOpen(true)} onOpenInstagramModal={() => setConnectInstagramModalOpen(true)} onOpenCreateContact={() => setCreateContactPanelOpen(true)} />}
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
const HomeSection = ({ onOpenConnectModal, onOpenInstagramModal, onOpenCreateContact }) => {
  const router = useRouter();
  
  return (
    <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Banner with Trial Info */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg p-4 mb-6 shadow-md">
          <h1 className="text-xl font-semibold !text-white">Hello, Vivek. Welcome to {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}! Only 7 days left in your trial</h1>
        </div>

        {/* Onboarding Progress Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            {/* Promo Section */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Complete Onboarding & Subscribe to get</p>
                <p className="text-sm font-semibold text-teal-600">FREE WhatsApp Conversation Credits worth</p>
                <p className="text-lg font-bold text-teal-600">Rs. 400 <span className="text-sm text-blue-600 cursor-pointer hover:underline">↗ Learn more</span></p>
              </div>
            </div>

            {/* Start Subscription Button */}
            <div className="flex-shrink-0">
              <button className="flex items-center space-x-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-6 py-3 rounded-lg font-semibold transition-colors shadow-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>Start Subscription</span>
                <span className="text-xs">& use Free Credits</span>
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="relative">
            <div className="flex items-center justify-between">
              {/* Step 1 - Start Onboarding */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Start</p>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Onboarding</p>
              </div>

              {/* Progress Line 1 */}
              <div className="flex-1 h-1 bg-teal-500 -mt-8"></div>

              {/* Step 2 - Basic Setup */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex items-center space-x-1 mb-1">
                  <span className="text-yellow-500 text-sm">💰</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">Rs. 100</span>
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Basic Setup</p>
              </div>

              {/* Progress Line 2 */}
              <div className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 -mt-8"></div>

              {/* Step 3 - Connect Number */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="flex items-center space-x-1 mb-1">
                  <span className="text-yellow-500 text-sm">💰</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">Rs. 300</span>
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Connect Number</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* WhatsApp Connection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Your WhatsApp number is not connected</p>
                </div>
              </div>
              <button 
                onClick={onOpenConnectModal}
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Connect your Number
              </button>
            </div>
          </div>

          {/* Instagram Connection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Your Business Instagram is not connected</p>
                </div>
              </div>
              <button 
                onClick={onOpenInstagramModal}
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Connect Account
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Features */}
          <div className="lg:col-span-2 space-y-4">
            {/* Bulk WhatsApp Campaigns */}
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Bulk WhatsApp campaigns</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Keep re-engaging with leads & paid customers</p>
                  <button 
                    onClick={() => router.push('/dashboard/campaign')}
                    className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>

            {/* Automate WhatsApp notifications */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Automate WhatsApp notifications</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Delight customers at every stage of their journey</p>
                  <button className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline">
                    →
                  </button>
                </div>
              </div>
            </div>

            {/* Automate FAQ Replies */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Automate FAQ Replies</h3>
                    <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded">👋</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Clear visitor doubts</p>
                  <button className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline">
                    →
                  </button>
                </div>
              </div>
            </div>

            {/* Automate WhatsApp catalog browsing */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Automate WhatsApp catalog browsing</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Convert visitors into prospective buyers</p>
                  <button className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline">
                    →
                  </button>
                </div>
              </div>
            </div>

            {/* Automate WhatsApp checkout */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Automate WhatsApp checkout</h3>
                    <button className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">View more →</button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Turn prospective buyers into paid customers</p>
                  <button className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline">
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Steps & Preview */}
          <div className="space-y-6">
            {/* PRE-REQUISITES */}
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4">PRE-REQUISITES</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Send bulk WhatsApp campaigns to 1000s of customers to re-engage them and drive repeat orders</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400">☐</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Add your customers to {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}</span>
                  </div>
                  <button 
                    onClick={onOpenCreateContact}
                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                  >
                    Add Customers
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400">☐</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Create a template & wait for its approval</span>
                  </div>
                  <button 
                    onClick={() => router.push('/dashboard/templates')}
                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                  >
                    Create Template ↗
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">STEPS TO SETUP</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400">☐</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Create a new campaign</span>
                  </div>
                  <button 
                    onClick={() => router.push('/dashboard/campaign')}
                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                  >
                    Create Campaign ↗
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl p-4 border border-gray-300 dark:border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">+1234-567-890</span>
                  </div>
                  <div className="text-gray-400 text-xs">Now</div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 italic mb-3">Tap me for product highlights</div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-2">
                  <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">Hey there 👋</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">Let us know what set of skin you are looking for?</p>
                  <div className="space-y-1">
                    <button className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
                      ✨ SKINCARE PRODUCTS
                    </button>
                    <button className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
                      ℹ️ See company
                    </button>
                  </div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">Click on the button below to initiate the conversation ℹ️</p>
                  <button className="w-full mt-2 bg-teal-500 text-white rounded px-3 py-1.5 text-xs font-medium hover:bg-teal-600">
                    📋 See products here
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Explore More Features */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Explore more exciting features!</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Add WhatsApp Contacts */}
            <div 
              onClick={onOpenCreateContact}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Add WhatsApp Contacts</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Manage contacts efficiently</p>
                </div>
              </div>
            </div>

            {/* Add Team Members */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Add Team Members</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Manage member permissions</p>
                </div>
              </div>
            </div>

            {/* Explore Integrations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Explore Integrations</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Link GSheets, FB forms & more</p>
                </div>
              </div>
            </div>

            {/* APIs & Webhooks */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">APIs & Webhooks</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Create custom integrations</p>
                </div>
              </div>
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