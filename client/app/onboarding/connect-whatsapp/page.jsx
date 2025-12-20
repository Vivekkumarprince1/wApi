"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConnectWhatsAppPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/esb");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center space-y-3">
        <p className="text-sm text-slate-600">Legacy WhatsApp connect flow has been removed.</p>
        <p className="text-base font-semibold text-slate-900">Use the automated Embedded Signup instead.</p>
        <button
          onClick={() => router.push("/esb")}
          className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Go to ESB flow
        </button>
      </div>
    </div>
  );
}
                <button
                  onClick={handleStartESB}
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaRocket />}
                  Start Setup
                </button>
              </div>
            )}

            {esbStep === "business_verify" && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Verify Your Business</h2>
                <p className="text-gray-600 mb-6">
                  Your business information is being verified with Meta. This may take a few moments.
                </p>
                <button
                  onClick={handleVerifyBusiness}
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaBuilding />}
                  Continue
                </button>
              </div>
            )}

            {esbStep === "phone_register" && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Register Phone Number</h2>
                <p className="text-gray-600 mb-6">
                  Enter the phone number you want to use for WhatsApp Business.
                </p>
                <div className="max-w-sm mx-auto mb-6">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleRegisterPhone}
                  disabled={loading || !phoneNumber.trim()}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaPhoneAlt />}
                  Send OTP
                </button>
              </div>
            )}

            {esbStep === "otp_verify" && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Verify OTP</h2>
                <p className="text-gray-600 mb-6">
                  Enter the 6-digit OTP sent to your WhatsApp number.
                </p>
                <div className="mb-6">
                  <OTPInput value={otp} onChange={setOtp} disabled={loading} />
                </div>
                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaKey />}
                  Verify OTP
                </button>
              </div>
            )}

            {esbStep === "system_user" && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Create System User</h2>
                <p className="text-gray-600 mb-6">
                  Setting up automated access for your WhatsApp Business API.
                </p>
                <button
                  onClick={handleCreateSystemUser}
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaUser />}
                  Create System User
                </button>
              </div>
            )}

            {esbStep === "waba_activate" && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Activate WhatsApp Business</h2>
                <p className="text-gray-600 mb-6">
                  Finalizing your WhatsApp Business setup and activating messaging.
                </p>
                <button
                  onClick={handleActivateWABA}
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loading ? <FaSpinner className="animate-spin" /> : <FaCog />}
                  Activate WhatsApp
                </button>
              </div>
            )}
          </div>
        )}

        {/* Skip Option */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/onboarding/complete')}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            Skip for now (you can connect later)
          </button>
        </div>
      </div>
    </div>
  );
};
