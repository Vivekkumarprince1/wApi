"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FaWhatsapp,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaPhoneAlt,
  FaInfoCircle,
  FaClock,
  FaRocket,
  FaShieldAlt,
  FaFacebook,
  FaArrowRight,
  FaArrowLeft,
  FaBuilding,
  FaUser,
  FaKey,
  FaCog
} from "react-icons/fa";
import { esbStart, esbStatus, esbRegisterPhone, esbVerifyOTP, esbCreateSystemUser, esbActivateWABA } from "@/lib/api";

/* =========================
   OTP INPUT COMPONENT
========================= */
const OTPInput = ({ value, onChange, disabled }) => {
  const inputRefs = useRef([]);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  useEffect(() => {
    onChange(otp.join(""));
  }, [otp, onChange]);

  const handleChange = (index, val) => {
    if (!/^\d?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    if (val && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      setOtp(pasted.split("").concat(Array(6).fill("")).slice(0, 6));
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
        />
      ))}
    </div>
  );
};

/* =========================
   MAIN PAGE
========================= */
export default function ConnectWhatsAppPage() {
  const router = useRouter();

  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ESB Flow State
  const [esbStep, setEsbStep] = useState("start"); // start, business_verify, phone_register, otp_verify, system_user, waba_activate, complete
  const [esbData, setEsbData] = useState(null);

  // Phone registration
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");

  // Status
  const [isConnected, setIsConnected] = useState(false);
  const [connectedNumber, setConnectedNumber] = useState(null);
  const [verifiedName, setVerifiedName] = useState(null);

  const popupRef = useRef(null);

  /* =========================
     INIT
  ========================= */
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await esbStatus();
      if (data?.status === 'completed') {
        setIsConnected(true);
        setConnectedNumber(data.phoneNumber);
        setVerifiedName(data.verifiedName);
        setEsbStep("complete");
      } else if (data?.currentStep) {
        setEsbStep(data.currentStep);
        setEsbData(data);
      }
    } catch (_) {}
    setPageLoading(false);
  };

  /* =========================
     ESB FLOW HANDLERS
  ========================= */

  // Step 1: Start ESB Flow
  const handleStartESB = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await esbStart();
      if (response.esbUrl) {
        // Redirect to ESB URL (more reliable than popup for OAuth)
        window.location.href = response.esbUrl;
      }
    } catch (err) {
      setError(err.message || "Failed to start ESB flow");
      setLoading(false);
    }
  };

  // Handle ESB callback after user completes Meta flow
  const handleESBCallback = async () => {
    try {
      setLoading(true);
      setError("");

      // Check ESB status after callback
      const status = await esbStatus();

      if (status.status === 'token_exchanged') {
        setEsbStep("business_verify");
        setEsbData(status);
      } else if (status.status === 'completed') {
        setEsbStep("complete");
        setSuccess("WhatsApp Business connected successfully!");
        setTimeout(() => router.push("/onboarding/complete"), 2000);
      } else {
        setError("ESB flow incomplete. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Failed to check ESB status");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Business and Get WABA
  const handleVerifyBusiness = async () => {
    try {
      setLoading(true);
      setError("");

      // This is handled automatically by the backend during callback
      // Just check status and move to next step
      const status = await esbStatus();

      if (status.businessAccountId && status.wabaId) {
        setEsbStep("phone_register");
        setEsbData(status);
      } else {
        setError("Business verification failed. Please contact support.");
      }
    } catch (err) {
      setError(err.message || "Failed to verify business");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Register Phone Number
  const handleRegisterPhone = async () => {
    if (!phoneNumber.trim()) {
      setError("Please enter a phone number");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await esbRegisterPhone(phoneNumber);
      setEsbStep("otp_verify");
      setEsbData(prev => ({ ...prev, phoneNumber }));

      setSuccess("OTP sent to your WhatsApp number!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to register phone number");
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await esbVerifyOTP(otp);
      setEsbStep("system_user");
      setEsbData(prev => ({ ...prev, phoneVerified: true }));

      setSuccess("Phone number verified successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Create System User
  const handleCreateSystemUser = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await esbCreateSystemUser();
      setEsbStep("waba_activate");
      setEsbData(prev => ({ ...prev, systemUserCreated: true }));

      setSuccess("System user created successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to create system user");
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Activate WABA
  const handleActivateWABA = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await esbActivateWABA();
      setEsbStep("complete");
      setIsConnected(true);
      setConnectedNumber(response.phoneNumbers?.[0]?.display_phone_number);
      setVerifiedName(response.phoneNumbers?.[0]?.verified_name);

      setSuccess("WhatsApp Business connected successfully!");
      setTimeout(() => router.push("/onboarding/complete"), 2000);
    } catch (err) {
      setError(err.message || "Failed to activate WABA");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     RENDER
  ========================= */
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaWhatsapp className="text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Connect WhatsApp Business
          </h1>
          <p className="text-gray-600">
            Set up your WhatsApp Business API with automated Meta integration
          </p>
        </div>

        {/* Success/Error Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <FaCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Connection Status */}
        {isConnected && (
          <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <FaCheckCircle className="text-green-500 text-xl" />
              <div>
                <h3 className="font-semibold text-green-800">WhatsApp Connected!</h3>
                <p className="text-green-700 text-sm">
                  Phone: {connectedNumber} | Verified: {verifiedName}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/onboarding/complete")}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Continue to Dashboard
            </button>
          </div>
        )}

        {/* ESB Flow Steps */}
        {!isConnected && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-8">
              {[
                { step: "start", label: "Start", icon: FaRocket },
                { step: "business_verify", label: "Business", icon: FaBuilding },
                { step: "phone_register", label: "Phone", icon: FaPhoneAlt },
                { step: "otp_verify", label: "OTP", icon: FaKey },
                { step: "system_user", label: "System", icon: FaUser },
                { step: "waba_activate", label: "Activate", icon: FaCog }
              ].map((item, index) => {
                const Icon = item.icon;
                const isActive = esbStep === item.step;
                const isCompleted = [
                  "business_verify", "phone_register", "otp_verify", "system_user", "waba_activate", "complete"
                ].includes(esbStep) && [
                  "start", "business_verify", "phone_register", "otp_verify", "system_user", "waba_activate"
                ].indexOf(esbStep) >= index;

                return (
                  <div key={item.step} className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-500 text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      <Icon className="text-sm" />
                    </div>
                    <span className={`text-xs font-medium ${
                      isCompleted ? 'text-green-600' :
                      isActive ? 'text-blue-600' :
                      'text-gray-400'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Step Content */}
            {esbStep === "start" && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Start WhatsApp Business Setup</h2>
                <p className="text-gray-600 mb-6">
                  We'll guide you through Meta's automated setup process to connect your WhatsApp Business API.
                </p>
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
