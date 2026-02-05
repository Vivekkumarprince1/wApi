'use client';

import { FaRobot, FaCog, FaToggleOn, FaToggleOff, FaShoppingCart, FaCreditCard } from 'react-icons/fa';
import { useState } from 'react';

export default function CheckoutBotPage(){
  const [botEnabled, setBotEnabled] = useState(true);
  const [features] = useState([
    { name: 'Product Catalog Integration', enabled: true, description: 'Automatically sync your product catalog' },
    { name: 'Payment Gateway', enabled: true, description: 'Accept payments directly via WhatsApp' },
    { name: 'Order Tracking', enabled: true, description: 'Send automated order status updates' },
    { name: 'Abandoned Cart Recovery', enabled: false, description: 'Re-engage customers who left items in cart' },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <FaRobot className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Checkout Bot</h1>
                <p className="text-white/90 text-sm mt-1">Automate your WhatsApp commerce checkout process</p>
              </div>
            </div>
            <button 
              onClick={() => setBotEnabled(!botEnabled)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-105 ${
                botEnabled ? 'bg-white text-[#13C18D]' : 'bg-white/20 text-white border border-white/30'
              }`}
            >
              {botEnabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
              <span>{botEnabled ? 'Bot Active' : 'Bot Inactive'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
                <FaShoppingCart className="text-white text-xl" />
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Checkouts Today</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">47</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                <FaCreditCard className="text-white text-xl" />
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">78.5%</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                <FaRobot className="text-white text-xl" />
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Bot Interactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">523</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bot Features</h3>
            <button className="px-4 py-2 bg-[#13C18D] text-white rounded-xl hover:bg-[#0e8c6c] transition-colors">
              <FaCog className="inline mr-2" />Configure
            </button>
          </div>
          <div className="space-y-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{feature.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{feature.description}</p>
                </div>
                <button className={`ml-4 p-2 rounded-lg ${
                  feature.enabled 
                    ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}>
                  {feature.enabled ? <FaToggleOn className="text-2xl" /> : <FaToggleOff className="text-2xl" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bot Flow Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Checkout Flow Preview</h3>
          <div className="space-y-3">
            {['Welcome Message', 'Product Selection', 'Cart Summary', 'Payment Details', 'Order Confirmation'].map((step, idx) => (
              <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] flex items-center justify-center text-white font-bold">
                  {idx + 1}
                </div>
                <span className="text-gray-900 dark:text-white font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
