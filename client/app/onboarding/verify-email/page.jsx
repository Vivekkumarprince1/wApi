'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaEnvelope, FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';
import { getCurrentUser, sendEmailVerificationOTP, verifyEmailOTP } from '@/lib/api';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Get user's email from API
    const getUserEmail = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const user = await getCurrentUser();
        if (user) {
          setEmail(user.email);

          // Check if already verified - redirect to Connect WhatsApp onboarding
          if (user.emailVerified) {
            router.push('/onboarding/connect-whatsapp');
            return;
          }

          // Auto-send OTP when page loads
          sendOTP();
        } else {
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('Error getting user:', err);
        router.push('/auth/login');
      }
    };

    getUserEmail();
  }, [router]);

  const sendOTP = async () => {
    try {
      setLoading(true);
      setError('');

      await sendEmailVerificationOTP();

      setOtpSent(true);
      setCountdown(60);

      // Start countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (err.message && err.message.includes('60 seconds')) {
        // Just silently start the countdown if rate limited (likely a duplicate mount)
        setOtpSent(true);
        setCountdown(60);
      } else {
        setError(err.message || 'Failed to send OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await verifyEmailOTP(otp);

      // Navigate to BSP onboarding
      router.push('/onboarding/connect-whatsapp');
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    await sendOTP();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-premium p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 1 of 2</span>
            <span className="text-sm font-medium text-primary">Verify Email</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{ width: '50%' }}></div>
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <FaEnvelope className="text-3xl text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Verify Your Email
          </h1>
          <p className="text-muted-foreground text-center">
            Enter the 6-character code sent to your email
          </p>
          {email && (
            <p className="text-sm text-muted-foreground mt-2 font-medium">
              {email}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center">
              <FaExclamationCircle className="text-red-600 mr-3" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleVerifyOTP} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              required
              maxLength={6}
              className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-transparent text-center text-2xl tracking-widest font-bold"
            />
          </div>

          {countdown > 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Resend code in {countdown}s
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={loading}
              className="w-full text-center text-sm text-primary hover:text-green-700 font-medium"
            >
              Resend Code
            </button>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <FaCheckCircle />
                Verify & Continue
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs text-blue-800">
            💡 <strong>Note:</strong> Verifying your email helps secure your account
            and ensures you receive important notifications about your WhatsApp Business account.
          </p>
        </div>
      </div>
    </div>
  );
}
