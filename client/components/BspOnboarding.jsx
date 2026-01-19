'use client';

/**
 * =============================================================================
 * BSP ONBOARDING COMPONENT - INTERAKT PARENTAL MODEL
 * =============================================================================
 * 
 * Clean, simple WhatsApp onboarding via BSP Embedded Signup V2
 * - Users connect their WhatsApp under your parent WABA
 * - Fully automated like Interakt
 * - No manual configuration required
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@/lib/api';

export default function BspOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Check for callback params
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const callbackError = searchParams.get('error');
  const errorMessage = searchParams.get('message');

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    // Handle callback error from Meta
    if (callbackError) {
      setError(errorMessage || 'Signup was cancelled or failed');
      setLoading(false);
      // Clear URL params
      router.replace('/onboarding/esb');
      return;
    }

    // If we have code and state, complete onboarding
    if (code && state) {
      completeOnboarding();
      return;
    }

    // Otherwise, load current status
    loadStatus();
  }, [code, state, callbackError]);

  // ==========================================================================
  // API CALLS
  // ==========================================================================

  const loadStatus = async () => {
    try {
      const response = await api.get('/onboarding/bsp/status');
      setStatus(response);
      
      // If already connected, redirect to dashboard
      if (response.connected) {
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    } catch (err) {
      console.error('Failed to load status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startOnboarding = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/onboarding/bsp/start', {});

      if (response.success && response.url) {
        // Redirect to Meta's ESB page
        window.location.href = response.url;
      } else {
        throw new Error(response.message || 'Failed to start signup');
      }
    } catch (err) {
      console.error('Failed to start onboarding:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await api.post('/onboarding/bsp/complete', {
        code,
        state
      });

      if (response.success) {
        // Clear URL params
        router.replace('/onboarding/esb');
        
        // Update status
        setStatus({
          connected: true,
          workspace: response.workspace
        });
        
        // Redirect to dashboard after showing success
        setTimeout(() => router.push('/dashboard'), 3000);
      } else {
        throw new Error(response.message || 'Failed to complete signup');
      }
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setError(err.message);
      // Clear URL params on error
      router.replace('/onboarding/esb');
    } finally {
      setProcessing(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) {
      return;
    }

    try {
      await api.post('/onboarding/bsp/disconnect', {});
      setStatus({ connected: false });
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError(err.message);
    }
  };

  // ==========================================================================
  // RENDER STATES
  // ==========================================================================

  // Processing callback
  if (processing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">Completing Setup...</h2>
          <p className="text-gray-600 mt-2">Connecting your WhatsApp Business</p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  // Already connected
  if (status?.connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          {/* Success Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Connected!</h1>
            <p className="text-gray-600 mt-2">Your business is ready to message customers</p>
          </div>

          {/* Connection Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Phone Number</span>
                <span className="font-medium">{status.workspace?.phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Display Name</span>
                <span className="font-medium">{status.workspace?.verifiedName || 'Pending'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quality Rating</span>
                <span className={`font-medium ${
                  status.workspace?.qualityRating === 'GREEN' ? 'text-green-600' :
                  status.workspace?.qualityRating === 'YELLOW' ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {status.workspace?.qualityRating || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Messaging Limit</span>
                <span className="font-medium">{status.workspace?.messagingLimit || 'Tier 1'}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={disconnect}
              className="w-full py-3 px-4 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition"
            >
              Disconnect WhatsApp
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not connected - Show connect UI
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Connect WhatsApp</h1>
          <p className="text-gray-600 mt-2">
            Link your WhatsApp Business to start messaging customers
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="mb-8 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Send unlimited messages</p>
              <p className="text-sm text-gray-600">Reach customers via WhatsApp Business API</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Use message templates</p>
              <p className="text-sm text-gray-600">Pre-approved templates for notifications</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Automated workflows</p>
              <p className="text-sm text-gray-600">Set up auto-replies and chatbots</p>
            </div>
          </div>
        </div>

        {/* Connect Button */}
        <button
          onClick={startOnboarding}
          disabled={loading}
          className="w-full py-4 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Starting...</span>
            </>
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-6.627-5.373-12-12-12zm-2 16l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z" fill="white"/>
              </svg>
              <span>Connect with Meta</span>
            </>
          )}
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center mt-6">
          By connecting, you agree to Meta's WhatsApp Business terms.
          Your data is securely stored and encrypted.
        </p>
      </div>
    </div>
  );
}
