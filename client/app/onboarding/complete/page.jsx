'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheckCircle, FaRocket, FaWhatsapp, FaUsers, FaEnvelope } from 'react-icons/fa';
import { get, post } from '@/lib/api';

export default function CompletePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  useEffect(() => {
    loadOnboardingStatus();
  }, []);

  const loadOnboardingStatus = async () => {
    try {
      const data = await get('/onboarding/status');
      setOnboardingStatus(data.status);
    } catch (err) {
      console.error('Load status error:', err);
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);

      await post('/onboarding/complete', {});

      // Navigate to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Complete onboarding error:', err);
      // Still navigate to dashboard
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step 4 of 4</span>
            <span className="text-sm font-medium text-green-600">Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* Success Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <FaCheckCircle className="text-5xl text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            🎉 You're All Set!
          </h1>
          <p className="text-xl text-gray-600 text-center">
            Your WhatsApp Business account is ready to go
          </p>
        </div>

        {/* Completion Summary */}
        <div className="mb-8 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What's been set up:</h2>
          
          <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
            <FaCheckCircle className="text-green-600 text-xl mt-1" />
            <div>
              <h3 className="font-medium text-gray-900">Email Verification</h3>
              <p className="text-sm text-gray-600">
                {onboardingStatus?.steps?.emailVerified 
                  ? 'Your email is verified' 
                  : 'You can verify later in settings'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
            <FaCheckCircle className="text-green-600 text-xl mt-1" />
            <div>
              <h3 className="font-medium text-gray-900">Business Information</h3>
              <p className="text-sm text-gray-600">
                {onboardingStatus?.steps?.businessInfo 
                  ? 'Your business profile is complete' 
                  : 'You can complete this later in settings'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
            <FaCheckCircle className="text-green-600 text-xl mt-1" />
            <div>
              <h3 className="font-medium text-gray-900">WhatsApp Connection</h3>
              <p className="text-sm text-gray-600">
                {onboardingStatus?.steps?.wabaConnection 
                  ? 'Connected to WhatsApp Business API' 
                  : 'You can connect later in settings'}
              </p>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Next Steps:</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FaUsers className="text-blue-600" />
              <span className="text-gray-700">Add contacts to start messaging</span>
            </div>
            <div className="flex items-center gap-3">
              <FaEnvelope className="text-purple-600" />
              <span className="text-gray-700">Create message templates</span>
            </div>
            <div className="flex items-center gap-3">
              <FaWhatsapp className="text-green-600" />
              <span className="text-gray-700">Send your first campaign</span>
            </div>
            <div className="flex items-center gap-3">
              <FaRocket className="text-orange-600" />
              <span className="text-gray-700">Explore automation features</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/dashboard/contacts')}
            className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors"
          >
            <FaUsers className="text-2xl text-green-600 mb-2" />
            <p className="font-medium text-gray-900">Add Contacts</p>
            <p className="text-xs text-gray-600">Import or create</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/templates')}
            className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <FaEnvelope className="text-2xl text-purple-600 mb-2" />
            <p className="font-medium text-gray-900">Create Template</p>
            <p className="text-xs text-gray-600">Message templates</p>
          </button>
        </div>

        {/* Main Action */}
        <button
          onClick={handleComplete}
          disabled={loading}
          className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:bg-gray-400 font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
        >
          {loading ? (
            'Loading...'
          ) : (
            <>
              <FaRocket />
              Go to Dashboard
            </>
          )}
        </button>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Need help getting started?
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <a href="/docs" className="text-green-600 hover:text-green-700 font-medium">
              View Documentation
            </a>
            <span className="text-gray-400">|</span>
            <a href="/support" className="text-green-600 hover:text-green-700 font-medium">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
