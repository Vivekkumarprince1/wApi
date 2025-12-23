"use client";

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaFacebookF } from 'react-icons/fa';
import { facebookLogin } from '@/lib/api';

const FacebookLogin = ({ onError, onSuccess, autoRedirect = true }) => {
  const router = useRouter();
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

  useEffect(() => {
    if (!appId || typeof window === 'undefined') {
      return;
    }

    // Check if FB SDK is already loaded and initialized
    if (window.FB) {
      return;
    }

    // Check if SDK is already being loaded
    if (document.getElementById('facebook-jssdk')) {
      return;
    }

    // Only set fbAsyncInit if it's not already set
    if (!window.fbAsyncInit) {
      window.fbAsyncInit = function fbInit() {
        window.FB.init({
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
      onError?.('Facebook SDK not loaded yet. Please try again in a moment.');
      return;
    }

    // Check if we're running on HTTPS (required for Facebook OAuth in production)
    // Allow HTTP on localhost for development
    if (typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        !window.location.hostname.includes('127.0.0.1')) {
      onError?.('Facebook login requires HTTPS in production. For development, ensure your Facebook app allows localhost.');
      return;
    }

    try {
      console.log('Facebook SDK loaded:', !!window.FB);
      console.log('Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
      console.log('Protocol:', typeof window !== 'undefined' ? window.location.protocol : 'N/A');
      console.log('Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');

      // Check if FB SDK is properly initialized
      if (!window.FB || typeof window.FB.login !== 'function') {
        console.error('Facebook SDK not available or login function missing');
        onError?.('Facebook SDK not properly initialized. Please refresh the page and try again.');
        return;
      }

      // For development, try to use a different approach if HTTPS is not available
      const isLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (!isLocalhost && window.location.protocol !== 'https:') {
        console.error('Facebook login requires HTTPS in production');
        onError?.('Facebook login requires HTTPS. Please ensure your site is served over HTTPS.');
        return;
      }

      console.log('Attempting Facebook login...');

      window.FB.login(
        (response) => {
          console.log('Facebook login response:', response);

          if (response.authResponse?.accessToken) {
            console.log('Facebook login successful, token received');
            (async () => {
              try {
                const result = await facebookLogin(response.authResponse.accessToken);
                const callbackResult = onSuccess?.(result);
                if (autoRedirect && callbackResult !== false) {
                  router.push('/dashboard');
                }
              } catch (error) {
                console.error('Facebook login API error:', error);
                onError?.(error.message || 'Failed to authenticate with server');
              }
            })();
          } else if (response.error) {
            console.error('Facebook login error:', response.error);
            onError?.(response.error.message || 'Facebook authentication failed');
          } else {
            console.log('Facebook login cancelled by user');
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

