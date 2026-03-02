'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SINGLE BSP ONBOARDING ENTRY POINT
 * Strict BSP flow - Partner app onboarding via Gupshup embed flow
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaWhatsapp, FaCheckCircle, FaExclamationCircle, FaSpinner, FaShieldAlt } from 'react-icons/fa';
import { getCurrentUser } from '@/lib/api';
import { bspStart, bspSync } from '@/lib/api';
import * as api from '@/lib/api';

export default function ESBOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [onboardingState, setOnboardingState] = useState('idle'); // idle | provisioning | waiting_for_meta

  useEffect(() => {
    // CRITICAL: Email verification gate
    const checkEmailVerification = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const userData = await getCurrentUser();
        if (!userData) {
          router.push('/auth/login');
          return;
        }

        // BLOCK access if email not verified
        if (!userData.emailVerified) {
          router.push('/onboarding/verify-email');
          return;
        }

        setUser(userData);
        setCheckingAuth(false);
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/auth/login');
      }
    };

    checkEmailVerification();
  }, [router]);

  // Poll for status if not connected (useful when onboarding in a new tab)
  useEffect(() => {
    if (checkingAuth || onboardingState === 'idle') return;

    const checkStatus = async () => {
      try {
        const statusRes = await api.get('/onboarding/bsp/status');
        if (statusRes?.connected || statusRes?.status === 'LIVE' || statusRes?.status === 'completed') {
          router.push('/dashboard');
        }
      } catch (err) {
        // Ignore errors during polling
      }
    };

    const interval = setInterval(checkStatus, 3000); // Check every 3 seconds for faster detection

    // Listen for postMessage from Gupshup embed window (if it signals success)
    const handleMessage = (event) => {
      // Allow any origin for Gupshup cross-domain communication
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'gupshup_onboarding_completed' || data?.status === 'success' || data?.appId) {
          console.log('Gupshup onboarding success message received:', data);
          // Force an immediate status check and wait short period to allow webhook sync
          setTimeout(() => checkStatus(), 1000);
          setOnboardingState('verifying_connection');
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };
  }, [checkingAuth, onboardingState, router]);

  const handleConnectWhatsApp = async () => {
    try {
      setLoading(true);
      setOnboardingState('provisioning');
      setError('');

      const response = await bspStart({
        callbackUrl: `${window.location.origin}/dashboard`
      });
      const signupUrl = response?.esbUrl || response?.url;

      if (!signupUrl) {
        throw new Error(response?.message || 'Failed to generate Gupshup onboarding URL');
      }

      // Open Gupshup onboarding embed in a new tab
      window.open(signupUrl, '_blank');

      setOnboardingState('waiting_for_meta');
      setLoading(false);
    } catch (err) {
      console.error('ESB start failed:', err);
      setError(err.message || 'Failed to start WhatsApp connection');
      setOnboardingState('idle');
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setLoading(true);
      setOnboardingState('verifying_connection');
      setError('');

      const syncRes = await bspSync();

      // Check if sync itself confirmed connection
      if (syncRes?.connected || syncRes?.stage1?.complete) {
        router.push('/dashboard');
        return;
      }

      if (syncRes?.success) {
        // Sync succeeded but connection not confirmed yet - wait and re-check
        setTimeout(async () => {
          try {
            const statusRes = await api.get('/onboarding/bsp/status');
            if (statusRes?.connected || statusRes?.status === 'LIVE' || statusRes?.status === 'completed') {
              router.push('/dashboard');
            } else {
              setError("Your phone number is still being activated by Gupshup. This can take a few minutes. Please try again shortly.");
              setOnboardingState('waiting_for_meta');
              setLoading(false);
            }
          } catch (err) {
            setError("We couldn't confirm your connection yet. Please make sure you completed the Facebook setup successfully.");
            setOnboardingState('waiting_for_meta');
            setLoading(false);
          }
        }, 2000);
      } else {
        throw new Error("Sync returned false");
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      setError("We could not confirm your connection. Please ensure you finished the Gupshup steps.");
      setOnboardingState('waiting_for_meta');
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3">
          <FaSpinner className="animate-spin text-2xl text-green-600" />
          <span className="text-gray-600">Verifying access...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 2 of 2</span>
            <span className="text-sm font-medium text-green-600">Connect WhatsApp</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <FaWhatsapp className="text-4xl text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Connect WhatsApp Business
          </h1>
          <p className="text-gray-600 text-center max-w-md">
            Connect your WhatsApp Business account using Gupshup Partner onboarding.
            You'll be redirected to Gupshup to complete setup.
          </p>
        </div>

        {/* User info */}
        {user && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <FaCheckCircle className="text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-600">{user.email} ✓ Verified</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <FaExclamationCircle className="text-red-600 mr-3" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {onboardingState === 'provisioning' && (
          <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg flex flex-col items-center justify-center text-center space-y-4">
            <FaSpinner className="animate-spin text-4xl text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Provisioning Workspace</h3>
              <p className="text-sm text-gray-600 mt-1">Creating your isolated partner app, securing API tokens, and registering webhook subscriptions...</p>
            </div>
          </div>
        )}

        {onboardingState === 'waiting_for_meta' && (
          <div className="mb-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center animate-pulse">
              <FaWhatsapp className="text-3xl text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Finish setup in the new tab</h3>
              <p className="text-sm text-gray-600 mt-1 mb-6">We are waiting for Meta to verify your account connection. Please complete the setup in the Gupshup window.</p>

              <button
                onClick={handleManualSync}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    I have completed the setup
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {onboardingState === 'verifying_connection' && (
          <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center justify-center text-center space-y-4">
            <FaSpinner className="animate-spin text-4xl text-green-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Almost there!</h3>
              <p className="text-sm text-gray-600 mt-1">Gupshup signaled completion. Verifying webhooks and finishing setup...</p>
            </div>
          </div>
        )}

        {/* What happens next */}
        {onboardingState === 'idle' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FaShieldAlt className="text-blue-600" />
              What happens next?
            </h3>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>We provision your Enterprise Partner App</li>
              <li>You'll be redirected to Meta / Facebook Platform</li>
              <li>Confirm your business details & phone number</li>
              <li>Return here to complete setup</li>
            </ol>
          </div>
        )}

        {/* CTA Button */}
        {onboardingState === 'idle' && (
          <button
            onClick={handleConnectWhatsApp}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <FaWhatsapp />
                Connect WhatsApp
              </>
            )}
          </button>
        )}

        {/* Security notice */}
        <p className="mt-4 text-xs text-center text-gray-500">
          Your credentials are never shared with us. Authentication is handled by Gupshup.
        </p>
      </div>
    </div>
  );
}
