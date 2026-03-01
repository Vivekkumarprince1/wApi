'use client';

import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { bspRegisterPhone } from '@/lib/api';

const ConnectNumberModal = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [loadingType, setLoadingType] = useState(null);
  const [error, setError] = useState('');
  const defaultRegion = process.env.NEXT_PUBLIC_GUPSHUP_DEFAULT_REGION || 'IN';

  if (!isOpen) return null;

  const handleConnectExisting = async () => {
    try {
      setError('');
      setLoadingType('business_app');

      const response = await bspRegisterPhone({ connectionType: 'business_app' });
      const signupUrl = response?.url;

      if (!signupUrl) {
        throw new Error('Failed to generate onboarding link');
      }

      window.open(signupUrl, '_blank');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to connect WhatsApp Business App');
    } finally {
      setLoadingType(null);
    }
  };

  const handleConnectNew = async () => {
    try {
      setError('');
      setLoadingType('new_number');

      await bspRegisterPhone({ connectionType: 'new_number', region: defaultRegion });
      router.push('/onboarding/esb');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to register new number');
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
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
        <div className="p-6 border-b border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleConnectExisting}
              disabled={loadingType !== null}
              className="bg-teal-500 hover:bg-primary text-primary-foreground px-6 py-4 rounded-lg font-medium transition-colors text-center"
            >
              {loadingType === 'business_app' ? 'Connecting...' : (
                <>
                  Connect your
                  <br />
                  WhatsApp Business
                  <br />
                  App
                </>
              )}
            </button>
            <button
              onClick={handleConnectNew}
              disabled={loadingType !== null}
              className="bg-white hover:bg-muted dark:hover:bg-gray-600 text-teal-600 dark:text-teal-400 border-2 border-teal-500 px-6 py-4 rounded-lg font-medium transition-colors"
            >
              {loadingType === 'new_number' ? 'Registering...' : 'Connect new number'}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Benefits Section */}
        <div className="p-6 bg-background">
          <h3 className="text-lg font-semibold text-foreground mb-4">
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
              <p className="text-sm text-foreground">
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
              <p className="text-sm text-foreground">
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
              <p className="text-sm text-foreground">
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
              <p className="text-sm text-foreground">
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
              <p className="text-sm text-foreground">
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
              <p className="text-sm text-foreground">
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
