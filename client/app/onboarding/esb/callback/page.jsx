'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * META ESB CALLBACK HANDLER
 * Processes OAuth code + state from Meta redirect
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { bspComplete } from '@/lib/api';

function ESBCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('processing'); // processing | success | error
  const [message, setMessage] = useState('Processing your WhatsApp connection...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          setStatus('error');
          setMessage('Invalid callback parameters. Please try connecting again.');
          return;
        }

        // Call BSP complete endpoint
        const response = await bspComplete({ code, state });

        if (response?.success) {
          setStatus('success');
          setMessage('WhatsApp connected successfully!');

          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          setStatus('error');
          setMessage(response?.message || 'Failed to complete WhatsApp connection');
        }
      } catch (err) {
        console.error('Callback processing failed:', err);
        setStatus('error');
        setMessage(err.message || 'An error occurred while connecting WhatsApp');
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
      <div className="flex flex-col items-center">
        {status === 'processing' && (
          <>
            <FaSpinner className="text-6xl text-green-600 animate-spin mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Setting up WhatsApp
            </h1>
            <p className="text-gray-600 text-center">
              {message}
            </p>
            <div className="mt-6 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <FaCheckCircle className="text-5xl text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              All Set!
            </h1>
            <p className="text-gray-600 text-center mb-4">
              {message}
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <FaExclamationTriangle className="text-5xl text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Connection Failed
            </h1>
            <p className="text-gray-600 text-center mb-6">
              {message}
            </p>
            <button
              onClick={() => router.push('/onboarding/esb')}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
      <div className="flex flex-col items-center">
        <FaSpinner className="text-6xl text-green-600 animate-spin mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Loading...
        </h1>
      </div>
    </div>
  );
}

export default function ESBCallbackPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <ESBCallbackContent />
      </Suspense>
    </div>
  );
}
