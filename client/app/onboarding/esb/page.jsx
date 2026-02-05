'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SINGLE BSP ONBOARDING ENTRY POINT
 * Strict BSP flow - Parent WABA only via Meta Embedded Signup V2
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaWhatsapp, FaCheckCircle, FaExclamationCircle, FaSpinner, FaShieldAlt } from 'react-icons/fa';
import { getCurrentUser } from '@/lib/api';
import { bspStart } from '@/lib/api';

export default function ESBOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

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
      const response = await bspStart();
      const signupUrl = response?.esbUrl || response?.url;

      if (!signupUrl) {
        throw new Error(response?.message || 'Failed to generate Meta signup URL');
      }

      // Redirect to Meta ESB
      window.location.href = signupUrl;
    } catch (err) {
      console.error('ESB start failed:', err);
      setError(err.message || 'Failed to start WhatsApp connection');
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
            Connect your WhatsApp Business account using Meta's secure authentication. 
            You'll be redirected to Meta to complete the setup.
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
            <li>You'll be redirected to Meta's secure platform</li>
            <li>Sign in with your Facebook Business account</li>
            <li>Select your WhatsApp Business account</li>
            <li>Grant permissions to manage messaging</li>
            <li>Return here to complete setup</li>
          </ol>
        </div>

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
          Your credentials are never shared with us. Authentication is handled directly by Meta.
        </p>
      </div>
    </div>
  );
}
