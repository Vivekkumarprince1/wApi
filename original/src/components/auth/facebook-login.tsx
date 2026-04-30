"use client";

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaFacebookF } from 'react-icons/fa';
import { facebookLogin } from '@/lib/api/auth';

export default function FacebookLogin({ onError, onSuccess, autoRedirect = true, formType }: any) {
  const router = useRouter();
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

  useEffect(() => {
    if (!appId || typeof window === 'undefined') {
      return;
    }

    if ((window as any).FB) return;
    if (document.getElementById('facebook-jssdk')) return;

    if (!(window as any).fbAsyncInit) {
      (window as any).fbAsyncInit = function fbInit() {
        (window as any).FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: 'v21.0',
        });
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
  }, [appId]);

  const handleLogin = useCallback(() => {
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

      (window as any).FB.login(
        (response: any) => {
          if (response.authResponse?.accessToken) {
            (async () => {
              try {
                const result = await facebookLogin(response.authResponse.accessToken);
                const callbackResult = onSuccess?.(result);
                if (autoRedirect && callbackResult !== false) {
                  router.push('/dashboard');
                }
              } catch (error: any) {
                onError?.(error.message || 'Failed to authenticate with server');
              }
            })();
          } else if (response.error) {
            onError?.(response.error.message || 'Facebook authentication failed');
          } else {
            onError?.('Facebook authentication was cancelled');
          }
        },
        { scope: 'email' }
      );
    } catch (error) {
      console.error('Facebook SDK error:', error);
      onError?.('Failed to initialize Facebook login. Please check your internet connection and try again.');
    }
  }, [appId, onError, onSuccess, autoRedirect, router]);

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={!appId}
      className={`w-full rounded-xl border-2 h-12 px-6 flex items-center justify-center gap-3 transition-all shadow-sm ${
        !appId
          ? 'border-gray-200 bg-white text-gray-500 cursor-not-allowed opacity-60'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-muted hover:border-gray-300 hover:shadow-md active:scale-[0.98]'
      }`}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1877f2] text-white">
        <FaFacebookF size={14} />
      </span>
      <span className="text-sm font-semibold tracking-wide">
        Sign in with Facebook
      </span>
    </button>
  );
}
