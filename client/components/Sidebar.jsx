
"use client";

import {
  FaTimes,
  FaHome,
  FaInbox,
  FaBullhorn,
  FaAddressBook,
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
} from "react-icons/fa";
import { useState } from "react";
import { useRouter } from "next/navigation";

const Sidebar = ({ isOpen, onClose, onSectionChange, currentPath }) => {
  const router = useRouter();
  const [openMarket, setOpenMarket] = useState(false);
  const [openSupport, setOpenSupport] = useState(false);
  const [openAutomation, setOpenAutomation] = useState(false);
  const [openSalesCRM, setOpenSalesCRM] = useState(false);
  const [openWhatsAppCommerce, setOpenWhatsAppCommerce] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const navigate = (path) => {
    router.push(path);
    onClose();
  };

  // Helper function to check if a path is active
  const isActive = (path) => {
    return currentPath === path || currentPath?.startsWith(path + '/');
  };

  return (
    <>
      {/* Desktop Sidebar - Always visible, expands on hover */}
      <div
        className={`hidden lg:block fixed top-0 left-0 h-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-lg z-40 transition-all duration-300 ${
          isHovered ? "w-64" : "w-16"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700 h-[57px]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 bg-teal-600 rounded flex items-center justify-center">
              <FaShoppingBag className="text-white text-lg" />
            </div>
            {isHovered && (
              <h1 className="text-xl font-bold text-gray-800 dark:text-white whitespace-nowrap">
                Interakt
              </h1>
            )}
          </div>
        </div>

        <div className="p-2 overflow-y-auto h-[calc(100vh-57px)]">
          {/* Home - Selected */}
          <div className="mb-4">
            <div
              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                isActive('/dashboard') && !currentPath?.includes('/dashboard/')
                  ? 'bg-teal-700 dark:bg-teal-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
              onClick={() => navigate("/dashboard")}
              title="Home"
            >
              <FaHome className={`flex-shrink-0 ${isActive('/dashboard') && !currentPath?.includes('/dashboard/') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
              {isHovered && <span className="whitespace-nowrap">Home</span>}
            </div>
          </div>

          {/* Quick Links */}
          {isHovered && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-2">
                Quick Links
              </p>
            </div>
          )}

          {/* Inbox */}
          <div
            className={`flex items-center gap-3 p-2 rounded cursor-pointer mb-1 transition-colors ${
              isActive('/dashboard/inbox')
                ? 'bg-teal-700 dark:bg-teal-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => navigate("/dashboard/inbox")}
            title="Inbox"
          >
            <FaInbox className={`flex-shrink-0 ${isActive('/dashboard/inbox') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
            {isHovered && <span className={isActive('/dashboard/inbox') ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>Inbox</span>}
          </div>

          {/* Main Menu Items */}
          <div className="space-y-1">
            {/* Campaigns */}
            <div
              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                isActive('/campaign')
                  ? 'bg-teal-700 dark:bg-teal-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => navigate("/campaign")}
              title="Campaigns"
            >
              <FaBullhorn className={`flex-shrink-0 ${isActive('/campaign') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
              {isHovered && <span className={isActive('/campaign') ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>Campaigns</span>}
            </div>

            {/* Contacts */}
            <div
              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                isActive('/dashboard/contacts')
                  ? 'bg-teal-700 dark:bg-teal-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => navigate("/dashboard/contacts")}
              title="Contacts"
            >
              <FaAddressBook className={`flex-shrink-0 ${isActive('/dashboard/contacts') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
              {isHovered && <span className={isActive('/dashboard/contacts') ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>Contacts</span>}
            </div>

            {/* Market */}
            <div
              className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              onClick={() => setOpenMarket(!openMarket)}
              title="Market"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FaStore className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                {isHovered && <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">Market</span>}
              </div>
              {isHovered && (
                <FaChevronDown
                  className={`text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                    openMarket ? "rotate-180" : ""
                  }`}
                />
              )}
            </div>
            {openMarket && isHovered && (
              <div className="ml-8 mt-1 space-y-1">
                <div
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    isActive('/dashboard/templates')
                      ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => navigate("/dashboard/templates")}
                >
                  <span className="whitespace-nowrap text-sm">📚 Templates & Library</span>
                </div>
                <div
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
                  onClick={() => navigate("/campaign")}
                >
                  <span className="whitespace-nowrap text-sm">Campaigns</span>
                </div>
                <div className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer text-gray-700 dark:text-gray-300 transition-colors">
                  <span className="whitespace-nowrap text-sm">Custom Campaign ...</span>
                </div>
                <div
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    isActive('/dashboard/ads')
                      ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => navigate('/dashboard/ads')}
                >
                  <span className="whitespace-nowrap text-sm">🎯 Ads</span>
                </div>
              </div>
            )}

            {/* Support */}
            <div
              className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              onClick={() => setOpenSupport(!openSupport)}
              title="Support"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FaHeadset className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                {isHovered && <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">Support</span>}
              </div>
              {isHovered && (
                <FaChevronDown
                  className={`text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                    openSupport ? "rotate-180" : ""
                  }`}
                />
              )}
            </div>
            {openSupport && isHovered && (
              <div className="ml-8 mt-1 space-y-1">
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/dashboard/inbox') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/dashboard/inbox')}>
                  <FaEnvelope className={`${isActive('/dashboard/inbox') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Inbox</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/support/chat-analytics') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/support/chat-analytics')}>
                  <FaChartBar className={`${isActive('/support/chat-analytics') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Chat Analytics</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/support/chat-assignment') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/support/chat-assignment')}>
                  <FaPlusSquare className={`${isActive('/support/chat-assignment') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Chat Assignment</span>
                </div>
              </div>
            )}

            {/* Automation */}
            <div
              className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              onClick={() => setOpenAutomation(!openAutomation)}
              title="Automation"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FaCogs className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                {isHovered && <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">Automation</span>}
              </div>
              {isHovered && (
                <FaChevronDown
                  className={`text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                    openAutomation ? "rotate-180" : ""
                  }`}
                />
              )}
            </div>
            {openAutomation && isHovered && (
              <div className="ml-8 mt-1 space-y-1">
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/automation/workflows') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/automation/workflows')}>
                  <span className="text-sm whitespace-nowrap">Workflows</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/automation/auto-replies') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/automation/auto-replies')}>
                  <span className="text-sm whitespace-nowrap">Auto Replies</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/automation/instagram-quickflows') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/automation/instagram-quickflows')}>
                  <span className="text-sm whitespace-nowrap">Instagram Quickflows</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/automation/whatsapp-forms') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/automation/whatsapp-forms')}>
                  <span className="text-sm whitespace-nowrap">WhatsApp Forms</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/automation/interaktive-list') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/automation/interaktive-list')}>
                  <span className="text-sm whitespace-nowrap">Interaktive List</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/automation/answerbot') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/automation/answerbot')}>
                  <span className="text-sm whitespace-nowrap">Answerbot</span>
                </div>
              </div>
            )}

            {/* Sales CRM */}
            <div
              className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              onClick={() => setOpenSalesCRM(!openSalesCRM)}
              title="Sales CRM"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FaChartLine className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                {isHovered && <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">Sales CRM</span>}
              </div>
              {isHovered && (
                <FaChevronDown
                  className={`text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                    openSalesCRM ? "rotate-180" : ""
                  }`}
                />
              )}
            </div>
            {openSalesCRM && isHovered && (
              <div className="ml-8 mt-1 space-y-1">
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/dashboard/contacts') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/dashboard/contacts')}>
                  <FaClipboardList className={`${isActive('/dashboard/contacts') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Contacts</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/sales-crm/pipeline') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/sales-crm/pipeline')}>
                  <FaListAlt className={`${isActive('/sales-crm/pipeline') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Sales Pipeline</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/sales-crm/reports') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/sales-crm/reports')}>
                  <FaClock className={`${isActive('/sales-crm/reports') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Sales CRM Reports</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/sales-crm/tasks') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/sales-crm/tasks')}>
                  <FaTasks className={`${isActive('/sales-crm/tasks') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Tasks</span>
                </div>
              </div>
            )}

            {/* WhatsApp Commerce */}
            <div
              className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              onClick={() => setOpenWhatsAppCommerce(!openWhatsAppCommerce)}
              title="WhatsApp Commerce"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FaShoppingCart className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                {isHovered && (
                  <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">WhatsApp Commerce</span>
                )}
              </div>
              {isHovered && (
                <FaChevronDown
                  className={`text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                    openWhatsAppCommerce ? "rotate-180" : ""
                  }`}
                />
              )}
            </div>
            {openWhatsAppCommerce && isHovered && (
              <div className="ml-8 mt-1 space-y-1">
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/commerce/settings') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/commerce/settings')}>
                  <FaCog className={`${isActive('/commerce/settings') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Commerce Settings</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/commerce/catalog') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/commerce/catalog')}>
                  <FaClipboardList className={`${isActive('/commerce/catalog') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Catalog</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/commerce/checkout-bot') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/commerce/checkout-bot')}>
                  <FaClock className={`${isActive('/commerce/checkout-bot') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Checkout Bot</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive('/commerce/order-panel') ? 'bg-teal-700 dark:bg-teal-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`} onClick={()=>navigate('/commerce/order-panel')}>
                  <FaBoxOpen className={`${isActive('/commerce/order-panel') ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                  <span className="text-sm whitespace-nowrap">Order Panel</span>
                </div>
              </div>
            )}

            {/* Integrations */}
            <div className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors" title="Integrations">
              <FaPuzzlePiece className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
              {isHovered && <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">Integrations</span>}
            </div>

            {/* Widget */}
            <div className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors" title="Widget">
              <FaThLarge className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
              {isHovered && <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">Widget</span>}
            </div>
          </div>
        </div>

        {/* Bottom Tour Button */}
        {isHovered && (
          <div className="absolute bottom-4 left-4 right-4 bg-gray-800 dark:bg-gray-700 rounded-lg p-3 text-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <span className="text-gray-800 text-xs">?</span>
              </div>
              <span className="text-sm font-medium">Need a Quick Navigation Tour?</span>
            </div>
            <button className="w-full bg-white text-gray-800 py-2 rounded text-sm font-medium hover:bg-gray-100 transition-colors">
              Start Tour
            </button>
          </div>
        )}
      </div>

      {/* Mobile Sidebar - Slides in from left */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 z-50 shadow-lg flex flex-col overflow-hidden`}
      >
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FaShoppingBag className="text-green-500 text-xl" />
          <h1 className="text-xl font-bold text-gray-800">Interakt</h1>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
          <FaTimes />
        </button>
      </div>

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
            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
            onClick={() => navigate('/dashboard/inbox')}
          >
            <FaInbox className="text-green-500" />
            <span className="text-gray-800">Inbox</span>
          </div>
        </div>

        {/* Main Menu Items */}
        <div className="space-y-1">
          {/* Campaigns */}
          <div 
            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
            onClick={() => navigate('/campaign')}
          >
            <FaBullhorn className="text-green-500" />
            <span className="text-gray-800">Campaigns</span>
          </div>

          {/* Contacts */}
          <div 
            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
            onClick={() => navigate('/dashboard/contacts')}
          >
            <FaAddressBook className="text-green-500" />
            <span className="text-gray-800">Contacts</span>
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
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                onClick={() => navigate('/dashboard/templates')}
              >
                <span>Templates</span>
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
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => setOpenAutomation(!openAutomation)}>
            <div className="flex items-center gap-3">
              <FaCogs className="text-green-500" />
              <span className="text-gray-800">Automation</span>
            </div>
            <FaChevronDown className={`text-gray-500 transition-transform ${openAutomation ? "rotate-180" : ""}`} />
          </div>

          {/* Sales CRM */}
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => setOpenSalesCRM(!openSalesCRM)}>
            <div className="flex items-center gap-3">
              <FaChartLine className="text-green-500" />
              <span className="text-gray-800">Sales CRM</span>
            </div>
            <FaChevronDown className={`text-gray-500 transition-transform ${openSalesCRM ? "rotate-180" : ""}`} />
          </div>

          {/* WhatsApp Commerce */}
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => setOpenWhatsAppCommerce(!openWhatsAppCommerce)}>
            <div className="flex items-center gap-3">
              <FaShoppingCart className="text-green-500" />
              <span className="text-gray-800">WhatsApp Commerce</span>
            </div>
            <FaChevronDown className={`text-gray-500 transition-transform ${openWhatsAppCommerce ? "rotate-180" : ""}`} />
          </div>

          {/* Integrations */}
          <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
            <FaPuzzlePiece className="text-green-500" />
            <span className="text-gray-800">Integrations</span>
          </div>

          {/* Widget */}
          <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
            <FaThLarge className="text-green-500" />
            <span className="text-gray-800">Widget</span>
          </div>

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

export default Sidebar;