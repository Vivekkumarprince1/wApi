"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaMobileAlt, FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';
import { sendMobileVerificationOTP, verifyMobileVerificationOTP } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function VerifyMobilePage() {
  const router = useRouter();
  const { user, phone: authPhone, fetchSession, loading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const hasSentInitialOTP = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // AuthInitializer handles strict routing, but we can pre-populate local state
    const currentPhone = authPhone?.number || '';
    if (currentPhone) {
      setPhone(currentPhone);
      
      // Auto-send OTP only once if phone exists and not yet verified
      if (!user.phoneVerified && !hasSentInitialOTP.current) {
        hasSentInitialOTP.current = true;
        sendOTP(currentPhone);
      }
    }
  }, [user, authPhone, authLoading, router]);

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOTP = async (phoneNumber = phone) => {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }
    
    try {
      setLoading(true);
      setError('');

      const response = await sendMobileVerificationOTP(phoneNumber);
      if (response?.phoneNumber) {
        setPhone(phoneNumber);
      }

      setOtpSent(true);
      startCountdown();
    } catch (err) {
      if (err.message && err.message.includes('60 seconds')) {
        setOtpSent(true);
        startCountdown();
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

      await verifyMobileVerificationOTP(phone, otp);
      await fetchSession(true); // Refresh session to update verified status
      router.push('/onboarding/business-info');
    } catch (err) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    await sendOTP(phone);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur rounded-3xl shadow-2xl border border-white/20 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Step 2 of 3</span>
            <span className="text-sm font-medium text-primary">Verify Mobile</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '66%' }} />
          </div>
        </div>

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <FaMobileAlt className="text-3xl text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Verify your mobile number</h1>
          <p className="text-muted-foreground">We will send a one-time code before you continue to business info.</p>
          {phone && <p className="text-sm text-muted-foreground mt-2 font-medium">{phone}</p>}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center">
              <FaExclamationCircle className="text-red-600 mr-3" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {!otpSent ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-foreground">Mobile number (with country code)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-transparent text-center text-lg tracking-wide"
            />
            <button
              type="button"
              onClick={() => sendOTP(phone)}
              disabled={loading || !phone}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
              Send verification code
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Verification code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                required
                maxLength={6}
                className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-ring focus:border-transparent text-center text-2xl tracking-widest font-bold"
              />
            </div>

            {countdown > 0 ? (
              <p className="text-center text-sm text-muted-foreground">Resend code in {countdown}s</p>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="w-full text-center text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                    Resend code
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOtpSent(false);
                        setOtp('');
                        setCountdown(0);
                    }}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground font-medium"
                >
                    Change mobile number
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
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
        )}
      </div>
    </div>
  );
}
