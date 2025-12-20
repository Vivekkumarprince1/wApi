"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  esbStart,
  esbStatus,
  esbRegisterPhone,
  esbVerifyOTP,
  esbCreateSystemUser,
  esbActivateWABA,
  esbProcessCallback,
  registerUser,
  getToken
} from "@/lib/api";

const STEP_ORDER = [
  "start",
  "waiting_callback",
  "phone_register",
  "otp_verify",
  "system_user",
  "activate",
  "complete"
];

function mapStatusToStep(status?: string) {
  switch (status) {
    case "token_exchanged":
    case "business_verified":
      return "phone_register";
    case "otp_sent":
      return "otp_verify";
    case "otp_verified":
      return "system_user";
    case "system_user_created":
      return "activate";
    case "waba_activated":
      return "complete";
    default:
      return "start";
  }
}

export default function EsbPage() {
  const router = useRouter();

  const [step, setStep] = useState<string>("start");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const [phone, setPhone] = useState("+");
  const [otp, setOtp] = useState("");
  const [esbData, setEsbData] = useState<any>(null);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [signup, setSignup] = useState({ name: "", email: "" });
  const [signupDone, setSignupDone] = useState(false);

  useEffect(() => {
    const token = getToken();
    setIsAuthed(!!token);
    loadStatus();

    // parse URL for callback params if present
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const callbackError = params.get("error");

      if (callbackError) {
        setError(`Meta returned an error: ${callbackError}`);
        return;
      }
      if (code && state) {
        // fire-and-forget; handleProcessCallback manages its own loading state
        handleProcessCallback(code, state);
      }
    } catch (_e) {
      // ignore when not running in browser
    }
  }, []);

  const activeStepIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);

  const loadStatus = async () => {
    try {
      const data = await esbStatus();
      const statusStep = mapStatusToStep(data?.esbStatus?.status);
      setStep(statusStep);
      setEsbData(data);
      if (statusStep === "complete") {
        setInfo("WhatsApp Business is connected and ready.");
      }
    } catch (_) {
      // ignore; user might be unauthenticated
    }
  };

  const handleSignup = async () => {
    if (!signup.name || !signup.email) {
      setError("Enter name and email to create your workspace");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const password = Math.random().toString(36).slice(-12);
      const data = await registerUser({ ...signup, password });
      if (data?.token) {
        setIsAuthed(true);
        setSignupDone(true);
        setInfo("Signup complete. Start Embedded Signup next.");
      }
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      setLoading(true);
      setError("");
      const resp = await esbStart();
      if (resp.esbUrl) {
        window.location.href = resp.esbUrl;
      }
    } catch (err: any) {
      setError(err.message || "Failed to start embedded signup");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessCallback = async (authCode: string, authState: string) => {
    try {
      setLoading(true);
      setError("");
      await esbProcessCallback(authCode, authState);
      setStep("phone_register");
      setInfo("Authorization confirmed. Please register your WhatsApp number.");
    } catch (err: any) {
      setError(err.message || "Failed to process Meta callback");
    } finally {
      setLoading(false);
      // clean query params from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleRegisterPhone = async () => {
    if (!phone || phone.length < 6) {
      setError("Enter a valid phone number with country code (e.g., +14155550123)");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await esbRegisterPhone(phone);
      setStep("otp_verify");
      setInfo("OTP sent by WhatsApp/Meta. Enter the 6-digit code.");
    } catch (err: any) {
      setError(err.message || "Failed to register phone");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError("Enter the 6-digit OTP sent by WhatsApp");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await esbVerifyOTP(otp);
      setStep("system_user");
      setInfo("Phone verified. Creating system user token next.");
    } catch (err: any) {
      setError(err.message || "Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSystemUser = async () => {
    try {
      setLoading(true);
      setError("");
      await esbCreateSystemUser();
      setStep("activate");
      setInfo("System user created. Activating WABA...");
    } catch (err: any) {
      setError(err.message || "Failed to create system user");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    try {
      setLoading(true);
      setError("");
      const resp = await esbActivateWABA();
      setStep("complete");
      setEsbData(resp);
      setInfo("WABA activated. You can now send messages via Cloud API.");
    } catch (err: any) {
      setError(err.message || "Failed to activate WABA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 shadow-lg rounded-2xl p-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Automated WhatsApp Onboarding</h1>
            <p className="text-sm text-slate-600">
              Embedded Signup + OTP + system user token — all driven by your Meta app config.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Skip to dashboard
          </button>
        </div>

        <div className="flex gap-3 mb-6">
          {STEP_ORDER.map((s, idx) => {
            const active = idx === activeStepIndex;
            const done = idx < activeStepIndex;
            return (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold border ${
                    done
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  {idx + 1}
                </div>
                <span className={`text-xs font-medium ${done ? "text-emerald-700" : active ? "text-slate-900" : "text-slate-400"}`}>
                  {s.replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {info}
          </div>
        )}

        {!isAuthed && (
          <div className="space-y-4 mb-8">
            <h2 className="text-lg font-semibold text-slate-900">Step 1 — Sign up on this platform</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={signup.name}
                onChange={(e) => setSignup((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                placeholder="Full name"
              />
              <input
                type="email"
                value={signup.email}
                onChange={(e) => setSignup((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                placeholder="Work email"
              />
            </div>
            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>
        )}

        {!isAuthed && (
          <p className="text-sm text-slate-600">After signup we will launch Meta Embedded Signup automatically.</p>
        )}

        {isAuthed && !signupDone && (
          <p className="text-xs text-slate-500 mb-3">Signed in via existing token.</p>
        )}

        {isAuthed && step === "start" && (
          <div className="space-y-3">
            <p className="text-slate-700 text-sm">
              Click the button below to open Meta's Embedded Signup (ESB) window. After completing Meta's prompts, you will be redirected back here automatically.
            </p>
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Starting..." : "Start Embedded Signup"}
            </button>
          </div>
        )}

        {isAuthed && step === "waiting_callback" && (
          <p className="text-slate-700 text-sm">Waiting for Meta to redirect you back with the authorization code...</p>
        )}

        {isAuthed && step === "phone_register" && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-800">WhatsApp number (with country code)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="+14155550123"
            />
            <button
              onClick={handleRegisterPhone}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Requesting OTP..." : "Register number & send OTP"}
            </button>
          </div>
        )}

        {isAuthed && step === "otp_verify" && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-800">Enter the 6-digit OTP from WhatsApp</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 tracking-widest text-center text-lg focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="123456"
              maxLength={6}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        )}

        {isAuthed && step === "system_user" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              We will create a system user and generate a token scoped to your WABA so you can send messages via Cloud API.
            </p>
            <button
              onClick={handleCreateSystemUser}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create system user & token"}
            </button>
          </div>
        )}

        {isAuthed && step === "activate" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Finalizing WABA activation and syncing limits. This uses your Meta app credentials configured on the server.
            </p>
            <button
              onClick={handleActivate}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Activating..." : "Activate WABA"}
            </button>
          </div>
        )}

        {isAuthed && step === "complete" && (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-emerald-700">All set!</h2>
            <p className="text-sm text-slate-700">
              Stored IDs:
              <br />WABA: {esbData?.wabaInfo?.wabaId || esbData?.wabaId || "-"}
              <br />Phone ID: {esbData?.wabaInfo?.phoneNumberId || esbData?.phoneNumberId || "-"}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
