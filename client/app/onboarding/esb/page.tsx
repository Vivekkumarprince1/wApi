"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  esbStart,
  esbStatus,
  esbProcessCallback,
  esbProcessStoredCallback,
  getToken
} from "@/lib/api";

const STEP_ORDER = [
  "start",
  "waiting_callback",
  "complete"
];

function mapStatusToStep(status?: string) {
  switch (status) {
    case "token_exchanged":
    case "business_verified":
    case "otp_sent":
    case "otp_verified":
    case "system_user_created":
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
  const [esbData, setEsbData] = useState<any>(null);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [pollTimeoutExceeded, setPollTimeoutExceeded] = useState(false);
  const MAX_POLL_DURATION = 5 * 60 * 1000; // 5 minutes max polling
  const pollStartTimeRef = { current: Date.now() };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Redirect to auth if not logged in
      router.push('/auth/login');
      return;
    }
    
    setIsAuthed(true);
    setAuthChecking(false);
    loadStatus();

    // parse URL for callback params if present
    try {
      const params = new URLSearchParams(window.location.search);
      const callbackReceived = params.get("callback_received");
      const state = params.get("state");
      const callbackError = params.get("error");
      const errorDescription = params.get("error_description");

      if (callbackError) {
        const errorMessage = errorDescription || callbackError;
        if (callbackError === 'invalid_state') {
          setError('Security verification failed. Please restart the signup flow.');
        } else if (callbackError === 'missing_params') {
          setError('Invalid callback from Meta. Please restart the signup flow.');
        } else {
          setError(`Meta returned an error: ${errorMessage}`);
        }
        // Clean query params
        cleanUrlParams();
        return;
      }

      if (callbackReceived && state) {
        // Callback was received, code is now stored in backend
        // Trigger processing of the stored callback
        setStep("waiting_callback");
        setInfo("Callback received. Processing your WhatsApp Business Account setup...");
        // Trigger backend to process the stored callback
        processStoredCallbackNow();
        // Clean query params
        cleanUrlParams();
      }
    } catch (_e) {
      // ignore when not running in browser
    }

    // Poll for status every 3 seconds in case backend is processing
    const pollInterval = setInterval(() => {
      // ✅ STOP polling if already completed or failed
      if (step === "complete" || step === "failed") {
        clearInterval(pollInterval);
        return;
      }
      
      // ✅ TIMEOUT: Stop polling after max duration to prevent infinite loops
      const elapsedTime = Date.now() - pollStartTimeRef.current;
      if (elapsedTime > MAX_POLL_DURATION) {
        console.warn('[ESB] Polling timeout exceeded after 5 minutes');
        setPollTimeoutExceeded(true);
        setError('WhatsApp setup is taking longer than expected. Please refresh the page or contact support.');
        clearInterval(pollInterval);
        return;
      }
      
      loadStatus();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [router]);

  const cleanUrlParams = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      url.searchParams.delete("callback_received");
      window.history.replaceState({}, "", url.toString());
    } catch (_e) {
      // ignore
    }
  };

  const activeStepIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);

  const loadStatus = async () => {
    try {
      const data = await esbStatus();
      const statusStep = mapStatusToStep(data?.esbStatus?.status);
      setStep(statusStep);
      setEsbData(data);
      
      if (statusStep === "complete") {
        setInfo("WhatsApp Business is connected and ready. Your messaging limits and plan have been applied.");
      } else if (data?.esbStatus?.status === 'failed') {
        // ✅ Show backend failure reason if available
        const failureReason = data.esbStatus.failureReason || 'An error occurred during setup';
        setError(`Setup failed: ${failureReason}`);
      } else if (data?.esbStatus?.status) {
        setInfo(`Current status: ${data.esbStatus.status}`);
      }
    } catch (_) {
      // ignore; user might be unauthenticated
    }
  };

  const handleStart = async () => {
    try {
      setLoading(true);
      setError("");
      setPollTimeoutExceeded(false);
      const resp = await esbStart();
      if (resp.url) {
        // ✅ Reset poll timer for new flow
        pollStartTimeRef.current = Date.now();
        // Open WhatsApp setup in a new window
        window.open(resp.url, '_blank');
        setStep("waiting_callback");
        setInfo("WhatsApp setup window opened. Complete the setup in the new window and it will redirect back here automatically.");
      } else {
        setError('Failed to start signup flow. No redirect URL provided by server.');
        setLoading(false);
      }
    } catch (err: any) {
      // ✅ FIX: Better error context for start failures
      const errorMsg = err.message || 'Failed to start embedded signup';
      if (errorMsg.includes('Rate limit') || errorMsg.includes('Too many')) {
        setError('Too many signup attempts. Please wait a few minutes before trying again.');
      } else if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('fetch')) {
        setError('Network error while contacting Meta. Please check your connection and try again.');
      } else {
        setError(errorMsg);
      }
      setLoading(false);
    }
  };

  const handleProcessCallback = async (authCode: string, authState: string) => {
    // Legacy function - no longer used since backend processes callback directly
    // Code is now stored in backend and processed via authenticated endpoint
    try {
      setLoading(true);
      setError("");
      const result = await esbProcessCallback(authCode, authState);
      setStep("complete");
      setEsbData(result);
      setInfo("WhatsApp Business Account connected successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to process Meta callback");
    } finally {
      setLoading(false);
      cleanUrlParams();
    }
  };

  const processStoredCallbackNow = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await esbProcessStoredCallback();
      if (result.success) {
        setStep("complete");
        setEsbData(result);
        setInfo(result.message || "WhatsApp Business Account connected successfully!");
      } else if (result.status) {
        // Still processing
        setInfo(result.message || "Processing...");
      }
    } catch (err: any) {
      // ✅ FIX: Improved error handling with specific error codes and recovery actions
      const errorCode = err.message;
      
      if (errorCode.includes('NO_CALLBACK_CODE')) {
        setError('No callback received. The Meta signup window may have been closed. Please click "Start WhatsApp Setup" again.');
        setStep("start");
      } else if (errorCode.includes('CODE_EXPIRED')) {
        setError('Your authorization code has expired (valid for 10 minutes only). Please restart the process.');
        setStep("start");
      } else if (errorCode.includes('STATE_VERIFICATION_FAILED')) {
        setError('Security verification failed. This could be a fraudulent request. Please restart.');
        setStep("start");
      } else if (errorCode.includes('INVALID_WABA_PHONE')) {
        setError('Failed to retrieve valid WABA or phone number from Meta. Please try again.');
        setStep("start");
      } else if (errorCode.includes('PHONE_WABA_MISMATCH')) {
        setError('The phone number does not belong to your WABA. Please verify with Meta support.');
        setStep("start");
      } else if (errorCode.includes('Rate limit') || errorCode.includes('Too many')) {
        setError('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        // Generic fallback error
        setError(err.message || 'An unexpected error occurred. Please try refreshing and starting again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 shadow-lg rounded-2xl p-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">WhatsApp Business Setup</h1>
            <p className="text-sm text-slate-600">
              Complete your WhatsApp Business Account connection
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
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 mb-2">{error}</p>
            {/* ✅ Add manual retry buttons for common error scenarios */}
            {pollTimeoutExceeded && (
              <button
                onClick={() => {
                  setError("");
                  setPollTimeoutExceeded(false);
                  loadStatus(); // Manual check
                }}
                className="text-xs font-medium text-red-700 hover:text-red-800 underline"
              >
                Check status manually
              </button>
            )}
            {error.includes('restart') && step === 'start' && (
              <button
                onClick={handleStart}
                className="text-xs font-medium text-red-700 hover:text-red-800 underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {info}
          </div>
        )}

        {step === "start" && (
          <div className="space-y-3">
            <p className="text-slate-700 text-sm">
              Click the button below to open Meta's Embedded Signup (ESB) window. After completing Meta's prompts, you will be redirected back here automatically.
            </p>
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Starting..." : "Start WhatsApp Setup"}
            </button>
          </div>
        )}

        {step === "waiting_callback" && (
          <p className="text-slate-700 text-sm">Meta ESB window is open. After you complete verification in the new window, you'll be automatically redirected back here.</p>
        )}

        {step === "complete" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-green-700 mb-2">✓ WhatsApp Connected!</h2>
              <p className="text-sm text-green-700">Your WhatsApp Business Account has been successfully connected.</p>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">WABA ID:</span>
                <span className="font-mono text-slate-900">{esbData?.wabaId || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Phone ID:</span>
                <span className="font-mono text-slate-900">{esbData?.phoneNumberId || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Phone Number:</span>
                <span className="font-mono text-slate-900">{esbData?.wabaInfo?.phoneNumber || "-"}</span>
              </div>
            </div>

            {esbData?.planLimits && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-blue-900">Plan Limits Applied</h3>
                <div className="flex justify-between">
                  <span className="text-blue-700">Daily Message Limit:</span>
                  <span className="font-mono text-blue-900">
                    {esbData.planLimits.messaging?.daily === -1 ? "Unlimited" : esbData.planLimits.messaging?.daily || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Template Limit:</span>
                  <span className="font-mono text-blue-900">
                    {esbData.planLimits.templates?.max === -1 ? "Unlimited" : esbData.planLimits.templates?.max || "-"}
                  </span>
                </div>
              </div>
            )}
            
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
