"use client";

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaFacebookF } from 'react-icons/fa';
import { facebookLogin } from '@/lib/api';

const FacebookLogin = ({ onError, onSuccess, autoRedirect = true }) => {
  const router = useRouter();
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

  useEffect(() => {
    if (!appId || typeof window === 'undefined' || window.FB) {
      return;
    }

    window.fbAsyncInit = function fbInit() {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v21.0',
      });
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    // Allow React devtools to access cross-origin errors from this script
    script.crossOrigin = 'anonymous';
    // Defensive FB init
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

    if (!window.FB) {
      onError?.('Facebook SDK not loaded yet');
      return;
    }

    window.FB.login(
      async (response) => {
        if (response.authResponse?.accessToken) {
          try {
            const result = await facebookLogin(response.authResponse.accessToken);
            const callbackResult = onSuccess?.(result);
            if (autoRedirect && callbackResult !== false) {
              router.push('/dashboard');
            }
          } catch (error) {
            onError?.(error.message);
          }
        } else {
          onError?.('Facebook authentication was cancelled');
        }
      },
      { scope: 'email' }
    );
  }, [appId, onError, onSuccess, autoRedirect, router]);

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={!appId}
      className={`w-full rounded-xl border-2 h-12 px-6 flex items-center justify-center gap-3 transition-all shadow-sm ${
        !appId
          ? 'border-gray-200 bg-white text-gray-500 cursor-not-allowed opacity-60'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md active:scale-[0.98]'
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
};

export default FacebookLogin;

