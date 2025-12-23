"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendLoginOTP, verifyLoginOTP } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: email, 2: OTP verification
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    setLoading(true);
    try {
      await sendLoginOTP({ email });
      setStatus({
        type: "success",
        message: "OTP sent to your email. Please check your console/email.",
      });
      setStep(2);
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to send reset code.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    setLoading(true);
    try {
      const result = await verifyLoginOTP({ email, otp });
      if (result.token) {
        localStorage.setItem('token', result.token);
        window.dispatchEvent(new Event('authChange'));
        setStatus({
          type: "success",
          message: "Password reset successful! Redirecting to dashboard...",
        });
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Invalid or expired OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl shadow-sm p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-center tracking-wide text-gray-900">
          Reset Password
        </h1>
        
        {step === 1 && (
          <>
            <p className="text-sm text-gray-600 text-center">
              Enter the email associated with your account and we will send you a
              one-time code to get back in.
            </p>
            {status.message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  status.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {status.message}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSendOTP}>
              <input
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-green-700 py-3 text-white font-semibold hover:bg-green-800 transition disabled:opacity-70"
              >
                {loading ? "Sending..." : "Send reset code"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-gray-600 text-center">
              Enter the 6-digit code sent to <span className="font-semibold text-gray-900">{email}</span>
            </p>
            <div className="text-center">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-green-700 hover:text-green-800 font-semibold"
              >
                Change email
              </button>
            </div>
            {status.message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  status.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {status.message}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleVerifyOTP}>
              <input
                type="text"
                required
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 text-center text-2xl font-semibold tracking-widest placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition"
              />
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-2xl bg-green-700 py-3 text-white font-semibold hover:bg-green-800 transition disabled:opacity-70"
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus({ type: "", message: "" });
                  setLoading(false);
                  handleSendOTP({ preventDefault: () => {} });
                }}
                disabled={loading}
                className="w-full text-sm text-gray-600 hover:text-gray-900 font-semibold"
              >
                Resend code
              </button>
            </form>
          </>
        )}

        <div className="text-center text-sm text-gray-600">
          <Link href="/auth/login" className="font-semibold text-gray-900 underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

