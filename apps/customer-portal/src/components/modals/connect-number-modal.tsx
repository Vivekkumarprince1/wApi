'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { bspComplete, bspStart, bspStatus as bspStage1Status, bspSync } from '@/lib/api/onboarding';
import { useAuthStore } from '@/store/auth-store';

const ACTIVE_PHONE_STATUSES = ['CONNECTED', 'RESTRICTED', 'LIVE', 'ACTIVE', 'VERIFIED'];

interface ConnectNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  callbackPayload?: any;
}

const ConnectNumberModal = ({ isOpen, onClose, callbackPayload = null }: ConnectNumberModalProps) => {
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [waitingForCompletion, setWaitingForCompletion] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const popupPollRef = useRef<any>(null);
  const statusPollRef = useRef<any>(null);
  const processedCallbackRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const { fetchSession, user } = useAuthStore();

  const cleanup = useCallback(() => {
    if (popupPollRef.current) { clearInterval(popupPollRef.current); popupPollRef.current = null; }
    if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null; }
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    popupRef.current = null;
    idempotencyKeyRef.current = null;
    setWaitingForCompletion(false);
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    cleanup();
    try {
      await bspSync();
    } catch (err: any) {
      console.warn('[ConnectNumberModal] Sync failed:', err.message);
    }
    await fetchSession(true);
    onClose();
  }, [cleanup, fetchSession, onClose]);

  const handleCallbackCompletion = useCallback(async (payload: any = {}) => {
    const code = payload?.code;
    const state = payload?.state;
    const providerError = payload?.error;
    const providerMessage = payload?.message;

    if (providerError) {
      cleanup();
      setError(providerMessage || 'WhatsApp signup was cancelled or failed.');
      return;
    }

    if (!code || !state) {
      return;
    }

    try {
      setError('');
      setWaitingForCompletion(true);
      await bspComplete({ code, state });
      await handleOnboardingComplete();
    } catch (err: any) {
      cleanup();
      setError(err.message || 'Failed to complete WhatsApp onboarding');
    }
  }, [cleanup, handleOnboardingComplete]);

  const openPopup = useCallback((url: string) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'gupshup_onboarding',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
    );

    if (!popup || popup.closed) {
      setError('Popup was blocked. Please allow popups for this site.');
      return null;
    }

    return popup;
  }, []);

  const startPolling = useCallback(() => {
    if (popupPollRef.current) clearInterval(popupPollRef.current);
    popupPollRef.current = setInterval(async () => {
      if (popupRef.current && popupRef.current.closed) {
        cleanup();
        try { await bspSync(); } catch (_) { }
        await fetchSession(true);
        onClose();
      }
    }, 1000);

    if (statusPollRef.current) clearInterval(statusPollRef.current);
    statusPollRef.current = setInterval(async () => {
      try {
        const result = await bspStage1Status();
        const stage1 = result?.stage1;
        const phoneStatus = String(stage1?.details?.phoneStatus || stage1?.phoneStatus || '').toUpperCase();

        if (stage1?.complete || ACTIVE_PHONE_STATUSES.includes(phoneStatus) || stage1?.checklist?.phoneConnected) {
          handleOnboardingComplete();
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    }, 5000);
  }, [cleanup, fetchSession, onClose, handleOnboardingComplete]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GUPSHUP_ONBOARDING_COMPLETE') {
        handleOnboardingComplete();
      }
      if (event.data?.type === 'GUPSHUP_ONBOARDING_CALLBACK') {
        handleCallbackCompletion(event.data?.payload || {});
      }
    };

    if (isOpen) {
      window.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, handleOnboardingComplete, handleCallbackCompletion]);

  useEffect(() => {
    if (!isOpen || !callbackPayload) return;

    const payloadKey = JSON.stringify(callbackPayload);
    if (processedCallbackRef.current === payloadKey) return;

    processedCallbackRef.current = payloadKey;
    handleCallbackCompletion(callbackPayload);
  }, [isOpen, callbackPayload, handleCallbackCompletion]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  if (!isOpen) return null;

  const handleConnect = async (connectionType: string) => {
    try {
      setError('');
      setLoadingType(connectionType);

      if (connectionType === 'new_number' && !String(user?.phone || '').replace(/\D/g, '')) {
        throw new Error('Add a phone number to your profile before registering a new number.');
      }

      const popup = openPopup('about:blank');
      if (!popup) return;

      popup.document.write(`
        <html>
          <head><title>Connecting WhatsApp...</title></head>
          <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,sans-serif;background:#f0fdf4;">
            <div style="text-align:center">
              <div style="width:48px;height:48px;border:4px solid #14b8a6;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
              <p style="color:#374151;font-size:16px;font-weight:500">Setting up your WhatsApp connection...</p>
              <p style="color:#6b7280;font-size:14px">Please wait, this may take a few seconds.</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
          </body>
        </html>
      `);

      popupRef.current = popup;
      setWaitingForCompletion(true);
      startPolling();

      const options: any = { connectionType };
      if (connectionType === 'new_number') {
        options.region = process.env.NEXT_PUBLIC_GUPSHUP_DEFAULT_REGION || 'IN';
        options.phoneNumber = String(user?.phone || '').replace(/\D/g, '') || undefined;
      }

      const idempotencyKey = idempotencyKeyRef.current || (idempotencyKeyRef.current = crypto.randomUUID());
      const response = await bspStart(options, {
        headers: {
          'x-idempotency-key': idempotencyKey
        }
      });
      const signupUrl = response?.url;

      if (!signupUrl) {
        cleanup();
        throw new Error('Failed to generate onboarding link');
      }

      popup.location.href = signupUrl;
    } catch (err: any) {
      cleanup();
      setError(err.message || 'Failed to connect WhatsApp');
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-premium max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            Connect WhatsApp Business API
          </h2>
          <button
            onClick={() => { cleanup(); onClose(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Waiting State */}
        {waitingForCompletion ? (
          <div className="p-10 flex flex-col items-center text-center">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <h3 className="text-lg font-bold text-foreground mb-2">
              Complete the setup in the popup window
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please complete the WhatsApp Business signup in the popup window.
              This page will update automatically once you're done.
            </p>
            <button
              onClick={() => {
                if (popupRef.current && !popupRef.current.closed) {
                  popupRef.current.focus();
                }
              }}
              className="text-primary hover:underline text-sm font-medium"
            >
              Can't see the popup? Click here to bring it back
            </button>
          </div>
        ) : (
          <>
            {/* Action Buttons */}
            <div className="p-6 border-b border-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => handleConnect('business_app')}
                  disabled={loadingType !== null}
                  className="bg-primary hover:brightness-110 text-primary-foreground px-4 py-4 rounded-xl font-bold transition-all text-center shadow-lg"
                >
                  {loadingType === 'business_app' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Provisioning...
                    </span>
                  ) : (
                    <>Connect your<br />WhatsApp App</>
                  )}
                </button>
                <button
                  onClick={() => handleConnect('new_number')}
                  disabled={loadingType !== null}
                  className="bg-background hover:bg-muted text-primary border-2 border-primary px-4 py-4 rounded-xl font-bold transition-all"
                >
                  {loadingType === 'new_number' ? 'Registering...' : 'Connect new number'}
                </button>
                <button
                  onClick={() => handleConnect('migrate')}
                  disabled={loadingType !== null}
                  className="bg-background hover:bg-muted text-violet-500 border-2 border-violet-500 px-4 py-4 rounded-xl font-bold transition-all"
                >
                  {loadingType === 'migrate' ? 'Migrating...' : 'Migrate API Number'}
                </button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              )}
            </div>

            {/* Benefits Section */}
            <div className="p-6 bg-muted/30">
              <h3 className="text-lg font-bold text-foreground mb-4">
                Why connect your WhatsApp Business App
              </h3>
              <div className="space-y-3">
                {[
                  { check: true, text: 'Send bulk campaigns and automated notifications.' },
                  { check: true, text: 'Build automated chat-flows and auto-replies.' },
                  { check: true, text: `View and reply to chats from both app and platform.` },
                  { check: false, text: "You won't be able to apply for a Blue Tick" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 w-6 h-6 ${item.check ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-destructive/10'} rounded-full flex items-center justify-center mt-0.5`}>
                      {item.check ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectNumberModal;
