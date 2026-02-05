'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SINGLE BSP ONBOARDING ENTRY POINT
 * Strict BSP flow - Parent WABA only via Meta Embedded Signup V2
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaWhatsapp, FaCheckCircle, FaExclamationCircle, FaSpinner, FaShieldAlt, FaExternalLinkAlt } from 'react-icons/fa';
import { getCurrentUser, esbStart, getEsbStatus } from '@/lib/api';

export default function ESBOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signupUrl, setSignupUrl] = useState('');
  const [showIframe, setShowIframe] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

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

  const handleConnectWhatsApp = async () => {
    try {
      setLoading(true);
      setError('');

      // Call BSP start endpoint
      const response = await esbStart();
      const url = response?.esbUrl || response?.url;

      if (!url) {
        throw new Error(response?.message || 'Failed to generate Meta signup URL');
      }

      // Open ESB inside embedded iframe (Meta ESB v3)
      setSignupUrl(url);
      setShowIframe(true);
    } catch (err) {
      console.error('ESB start failed:', err);
      setError(err.message || 'Failed to start WhatsApp connection');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let interval = null;

    const fetchStatus = async () => {
      try {
        const status = await getEsbStatus();
        setOnboardingStatus(status?.status || status?.workspace || status);
      } catch (statusErr) {
        // Silent failure (non-blocking)
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 10000);

    return () => interval && clearInterval(interval);
  }, [user]);

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
            Connect your WhatsApp Business phone number using Meta Embedded Signup (ESB v3). 
            The platform owns the Parent WABA and manages all tokens, templates, and webhooks.
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

        {/* What happens next */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <FaShieldAlt className="text-blue-600" />
            What happens next?
          </h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Embedded Signup opens securely inside Meta's iframe</li>
            <li>Sign in with your Facebook Business account</li>
            <li>Select your WhatsApp Business account</li>
            <li>Grant permissions to manage messaging</li>
            <li>Return here to complete setup</li>
          </ol>
        </div>

        {onboardingStatus && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
            <div className="font-semibold">Onboarding status</div>
            <div className="mt-1">{onboardingStatus?.status || onboardingStatus?.phoneStatus || 'In progress'}</div>
          </div>
        )}

        {/* CTA Button */}
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
              Continue to Meta
            </>
          )}
        </button>

        {/* Security notice */}
        <p className="mt-4 text-xs text-center text-gray-500">
          Tokens and Meta credentials are never exposed to customers. The platform manages all access.
        </p>
      </div>

      {showIframe && signupUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-semibold text-gray-700">Meta Embedded Signup</div>
              <div className="flex items-center gap-3">
                <a
                  href={signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-green-700 flex items-center gap-1"
                >
                  Open in new tab <FaExternalLinkAlt />
                </a>
                <button
                  onClick={() => setShowIframe(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              title="Meta Embedded Signup"
              src={signupUrl}
              className="w-full h-full"
              allow="clipboard-write; encrypted-media"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </div>
      )}
    </div>
  );
}
