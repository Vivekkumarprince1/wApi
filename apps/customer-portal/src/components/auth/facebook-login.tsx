"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaFacebookF } from 'react-icons/fa';
import { facebookLogin } from '@/lib/api/auth';

export default function FacebookLogin({ onError, onSuccess, autoRedirect = true, formType }: any) {
  const router = useRouter();
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const [isLoading, setIsLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const loginButtonRef = useRef<HTMLDivElement>(null);

  const authenticateWithFacebookToken = useCallback(async (accessToken: string) => {
    const result = await facebookLogin(accessToken);
    const callbackResult = await onSuccess?.(result);
    if (autoRedirect && !onSuccess && callbackResult !== false) {
      router.push('/');
    }
  }, [autoRedirect, onSuccess, router]);

  const statusChangeCallback = useCallback((response: any, cancelled = false) => {
    if (cancelled || response.status !== 'connected' || !response.authResponse?.accessToken) {
      return;
    }

    setIsLoading(true);
    authenticateWithFacebookToken(response.authResponse.accessToken)
      .catch((error: any) => {
        if (!cancelled) {
          onError?.(error.message || 'Failed to authenticate with server');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
  }, [authenticateWithFacebookToken, onError]);

  useEffect(() => {
    if (!appId || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    const checkLoginStatus = () => {
      const fb = (window as any).FB;
      if (!fb || typeof fb.getLoginStatus !== 'function') return;

      fb.getLoginStatus((response: any) => {
        statusChangeCallback(response, cancelled);
      });
    };

    (window as any).checkLoginState = checkLoginStatus;
    loginButtonRef.current?.setAttribute('onlogin', 'checkLoginState();');

    const parseLoginButton = () => {
      const fb = (window as any).FB;
      if (!fb) return;
      setSdkReady(true);
      if (loginButtonRef.current && typeof fb.XFBML?.parse === 'function') {
        fb.XFBML.parse(loginButtonRef.current.parentElement || loginButtonRef.current);
      }
    };

    if ((window as any).FB) {
      parseLoginButton();
      checkLoginStatus();
      return () => {
        cancelled = true;
      };
    }

    if (document.getElementById('facebook-jssdk')) {
      parseLoginButton();
      return () => {
        cancelled = true;
      };
    }

    if (!(window as any).fbAsyncInit) {
      (window as any).fbAsyncInit = function fbInit() {
        (window as any).FB.init({
          appId,
          cookie: true,
          xfbml: true,
          version: 'v21.0',
        });
        parseLoginButton();
        checkLoginStatus();
      };
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    try {
      document.body.appendChild(script);
    } catch (e) {
      console.warn('Failed to append Facebook SDK script', e);
    }
    return () => {
      cancelled = true;
      if ((window as any).checkLoginState === checkLoginStatus) {
        delete (window as any).checkLoginState;
      }
    };
  }, [appId, statusChangeCallback]);

  const handleLogin = useCallback(() => {
    if (isLoading) return;

    if (!appId) {
      onError?.('Facebook App ID not configured. Please add NEXT_PUBLIC_FACEBOOK_APP_ID to environment variables.');
      return;
    }

    if (!(window as any).FB) {
      onError?.('Facebook SDK not loaded yet. Please try again in a moment.');
      return;
    }

    if (typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        !window.location.hostname.includes('127.0.0.1')) {
      onError?.('Facebook login requires HTTPS in production. For development, ensure your Facebook app allows localhost.');
      return;
    }

    try {
      if (!(window as any).FB || typeof (window as any).FB.login !== 'function') {
        onError?.('Facebook SDK not properly initialized. Please refresh the page and try again.');
        return;
      }

      setIsLoading(true);
      (window as any).FB.login(
        (response: any) => {
          if (response.authResponse?.accessToken) {
            (async () => {
              try {
                await authenticateWithFacebookToken(response.authResponse.accessToken);
              } catch (error: any) {
                onError?.(error.message || 'Failed to authenticate with server');
              } finally {
                setIsLoading(false);
              }
            })();
          } else if (response.error) {
            onError?.(response.error.message || 'Facebook authentication failed');
            setIsLoading(false);
          } else {
            onError?.('Facebook authentication was cancelled');
            setIsLoading(false);
          }
        },
        { scope: 'email' }
      );
    } catch (error) {
      setIsLoading(false);
      console.error('Facebook SDK error:', error);
      onError?.('Failed to initialize Facebook login. Please check your internet connection and try again.');
    }
  }, [appId, authenticateWithFacebookToken, onError, isLoading]);

  return (
    <div className="w-full">
      {appId && (
        <div className={sdkReady && !isLoading ? 'flex min-h-12 items-center justify-center' : 'hidden'}>
          <div
            ref={loginButtonRef}
            className="fb-login-button"
            data-width=""
            data-size="large"
            data-button-type="continue_with"
            data-layout="default"
            data-auto-logout-link="false"
            data-use-continue-as="true"
            data-scope="email"
          />
        </div>
      )}

      {(!sdkReady || isLoading || !appId) && (
        <button
          type="button"
          onClick={handleLogin}
          disabled={!appId || isLoading}
          className={`w-full rounded-xl border-2 h-12 px-6 flex items-center justify-center gap-3 transition-all shadow-sm ${
            !appId || isLoading
              ? 'border-gray-200 bg-white text-gray-500 cursor-not-allowed opacity-60'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-muted hover:border-gray-300 hover:shadow-md active:scale-[0.98]'
          }`}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1877f2] text-white">
            <FaFacebookF size={14} />
          </span>
          <span className="text-sm font-semibold tracking-wide">
            {isLoading ? 'Connecting to Facebook...' : 'Sign in with Facebook'}
          </span>
        </button>
      )}
    </div>
  );
}
// Re-triggering build
