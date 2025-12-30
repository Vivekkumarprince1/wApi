'use client';

import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

const ConnectNumberModal = ({ isOpen, onClose }) => {
  const router = useRouter();

  if (!isOpen) return null;

  const handleConnectExisting = () => {
    // Navigate to settings page to connect existing WhatsApp Business App
    router.push('/dashboard/settings');
    onClose();
  };

  const handleConnectNew = () => {
    // Navigate to settings page to connect new number
    router.push('/dashboard/settings');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Connect a Number for your WhatsApp Business API Account
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleConnectExisting}
              className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-4 rounded-lg font-medium transition-colors text-center"
            >
              Connect your
              <br />
              WhatsApp Business
              <br />
              App
            </button>
            <button
              onClick={handleConnectNew}
              className="bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-teal-600 dark:text-teal-400 border-2 border-teal-500 px-6 py-4 rounded-lg font-medium transition-colors"
            >
              Connect new number
            </button>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Why connect your WhatsApp Business App
          </h3>
          
          <div className="space-y-3">
            {/* Benefit 1 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Send bulk campaigns and automated notifications.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Build automated chat-flows and auto-replies.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                View and reply to chats from both WhatsApp Business App and {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Continue using Groups, Status, Calling etc on the Business App
              </p>
            </div>

            {/* Limitation 1 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                You won't be able to apply for a Blue Tick
              </p>
            </div>

            {/* Limitation 2 */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                You won't be able to sync your {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} or Shopify Catalog into your WhatsApp profile. You can manage the Catalog from the Business App directly
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectNumberModal;
