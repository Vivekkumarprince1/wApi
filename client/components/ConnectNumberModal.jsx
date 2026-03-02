'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaTimes } from 'react-icons/fa';
import { bspStart, bspStage1Status, bspSync } from '@/lib/api';
import { useWorkspace } from '@/lib/useWorkspace';

/**
 * ConnectNumberModal
 * 
 * Opens Gupshup embed signup in a popup window.
 * Polls stage1-status every 5s to detect when onboarding completes.
 * When complete → closes popup, refetches workspace, closes modal.
 */
const ConnectNumberModal = ({ isOpen, onClose }) => {
  const [loadingType, setLoadingType] = useState(null);
  const [error, setError] = useState('');
  const [waitingForCompletion, setWaitingForCompletion] = useState(false);
  const popupRef = useRef(null);
  const popupPollRef = useRef(null);
  const statusPollRef = useRef(null);
  const { refetch } = useWorkspace();

  // Cleanup all timers and popup
  const cleanup = useCallback(() => {
    if (popupPollRef.current) { clearInterval(popupPollRef.current); popupPollRef.current = null; }
    if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null; }
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    popupRef.current = null;
    setWaitingForCompletion(false);
  }, []);

  // Called when onboarding is detected as complete
  const handleOnboardingComplete = useCallback(async () => {
    cleanup();
    // Trigger sync to pull phone number, WABA ID, etc. from Gupshup
    try {
      console.log('[ConnectNumberModal] Triggering workspace sync...');
      await bspSync();
      console.log('[ConnectNumberModal] Sync complete!');
    } catch (err) {
      console.warn('[ConnectNumberModal] Sync failed:', err.message);
    }
    refetch();
    onClose();
  }, [cleanup, refetch, onClose]);

  // Open URL in a centered popup window
  const openPopup = useCallback((url) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'gupshup_onboarding',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
    );

    if (!popup || popup.closed) {
      setError('Popup was blocked. Please allow popups for this site.');
      return null;
    }

    return popup;
  }, []);

  // Start polling: (1) check if popup closed, (2) poll stage1-status for completion
  const startPolling = useCallback(() => {
    // Poll 1: Check if popup was closed by user
    if (popupPollRef.current) clearInterval(popupPollRef.current);
    popupPollRef.current = setInterval(async () => {
      if (popupRef.current && popupRef.current.closed) {
        // Popup was closed — trigger sync then refetch and close modal
        cleanup();
        try { await bspSync(); } catch (_) { }
        refetch();
        onClose();
      }
    }, 1000);

    // Poll 2: Check stage1-status for onboarding completion (every 5s)
    if (statusPollRef.current) clearInterval(statusPollRef.current);
    statusPollRef.current = setInterval(async () => {
      try {
        const result = await bspStage1Status();
        const stage1 = result?.stage1;

        // If phone is connected or stage1 is complete, onboarding succeeded
        if (stage1?.complete || stage1?.phoneStatus === 'CONNECTED' || stage1?.checklist?.phoneConnected) {
          console.log('[ConnectNumberModal] Onboarding complete detected via polling!');
          handleOnboardingComplete();
        }
      } catch (err) {
        // Silently ignore polling errors
        console.warn('[ConnectNumberModal] Status poll error:', err.message);
      }
    }, 5000);
  }, [cleanup, refetch, onClose, handleOnboardingComplete]);

  // Listen for postMessage from callback page (if Gupshup ever redirects to it)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GUPSHUP_ONBOARDING_COMPLETE') {
        handleOnboardingComplete();
      }
    };

    if (isOpen) {
      window.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, handleOnboardingComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  if (!isOpen) return null;

  const handleConnect = async (connectionType) => {
    try {
      setError('');
      setLoadingType(connectionType);

      // Open popup IMMEDIATELY during click event (before async call)
      const popup = openPopup('about:blank');
      if (!popup) return;

      // Show loading in popup
      popup.document.write(`
        <html>
          <head><title>Connecting WhatsApp...</title></head>
          <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,sans-serif;background:#f0fdf4;">
            <div style="text-align:center">
              <div style="width:48px;height:48px;border:4px solid #14b8a6;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
              <p style="color:#374151;font-size:16px;font-weight:500">Setting up your WhatsApp connection...</p>
              <p style="color:#6b7280;font-size:14px">Please wait, this may take a few seconds.</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
          </body>
        </html>
      `);

      popupRef.current = popup;
      setWaitingForCompletion(true);
      startPolling();

      const options = { connectionType };
      if (connectionType === 'new_number') {
        options.region = process.env.NEXT_PUBLIC_GUPSHUP_DEFAULT_REGION || 'IN';
      }

      const response = await bspStart(options);
      const signupUrl = response?.url;

      if (!signupUrl) {
        cleanup();
        throw new Error('Failed to generate onboarding link');
      }

      // Redirect popup to embed URL
      popup.location.href = signupUrl;
    } catch (err) {
      cleanup();
      setError(err.message || 'Failed to connect WhatsApp');
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
            onClick={() => { cleanup(); onClose(); }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Waiting State */}
        {waitingForCompletion ? (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-6" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Complete the setup in the popup window
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please complete the WhatsApp Business signup in the popup window.
              This page will update automatically once you&apos;re done.
            </p>
            <button
              onClick={() => {
                if (popupRef.current && !popupRef.current.closed) {
                  popupRef.current.focus();
                }
              }}
              className="text-teal-600 hover:text-teal-700 text-sm font-medium underline"
            >
              Can&apos;t see the popup? Click here to bring it back
            </button>
          </div>
        ) : (
          <>
            {/* Action Buttons */}
            <div className="p-6 border-b border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleConnect('business_app')}
                  disabled={loadingType !== null}
                  className="bg-teal-500 hover:bg-primary text-primary-foreground px-6 py-4 rounded-lg font-medium transition-colors text-center"
                >
                  {loadingType === 'business_app' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Provisioning...
                    </span>
                  ) : (
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
                  onClick={() => handleConnect('new_number')}
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
                {[
                  { check: true, text: 'Send bulk campaigns and automated notifications.' },
                  { check: true, text: 'Build automated chat-flows and auto-replies.' },
                  { check: true, text: `View and reply to chats from both WhatsApp Business App and ${process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}.` },
                  { check: true, text: 'Continue using Groups, Status, Calling etc on the Business App' },
                  { check: false, text: "You won't be able to apply for a Blue Tick" },
                  { check: false, text: `You won't be able to sync your ${process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'} or Shopify Catalog into your WhatsApp profile.` },
                ].map((item, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 w-6 h-6 ${item.check ? 'bg-teal-100 dark:bg-teal-900' : 'bg-red-100 dark:bg-red-900'} rounded-full flex items-center justify-center mt-0.5`}>
                      <svg className={`w-4 h-4 ${item.check ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {item.check ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                    </div>
                    <p className="text-sm text-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectNumberModal;
