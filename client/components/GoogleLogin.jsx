import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { googleLogin } from '@/lib/api';
import { getGoogleAuthUrl } from '@/lib/api';

const GoogleLogin = ({ onError, onSuccess, formType = 'signup', autoRedirect = true }) => {
  const router = useRouter();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [scriptFailed, setScriptFailed] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  useEffect(() => {
    try {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.info('[GoogleLogin] NEXT_PUBLIC_GOOGLE_CLIENT_ID:', clientId, 'origin:', window.location?.origin);
      }
    } catch (e) {
      // ignore
    }

    if (!clientId) {
      setScriptFailed(true);
      return;
    }

    let scriptTimer = null;

    const initializeGoogleSignIn = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setIsGoogleReady(true);
        setScriptFailed(false);
      }
    };

    const handleCredentialResponse = async (response) => {
      try {
        const result = await googleLogin(response.credential);

        // Check if OTP is required (new flow)
        if (result.message && result.message.includes('OTP sent')) {
          // Trigger OTP verification flow
          onSuccess?.(result);
        } else {
          // Legacy flow - direct login
          const callbackResult = onSuccess?.(result);
          if (autoRedirect && callbackResult !== false) {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        onError?.(error.message);
      }
    };

    // Load Google Identity Services
    const loadGoogleScript = () => {
      // Check if script is already present
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        if (window.google) {
          initializeGoogleSignIn();
        } else {
          // Script exists but not loaded? Wait for it? 
          // It's safer to just rely on the existing script's onload if it's there.
          // Or we can poll a few times.
          const checkInterval = setInterval(() => {
            if (window.google) {
              clearInterval(checkInterval);
              initializeGoogleSignIn();
            }
          }, 100);
          setTimeout(() => clearInterval(checkInterval), 3000);
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        initializeGoogleSignIn();
      };

      script.onerror = () => {
        setScriptFailed(true);
      };

      try {
        document.head.appendChild(script);
      } catch (e) {
        console.warn('Failed to append Google Identity script', e);
        setScriptFailed(true);
      }

      // If script doesn't load within 2s, show fallback
      scriptTimer = setTimeout(() => {
        if (!window.google) {
          setScriptFailed(true);
        }
      }, 2000);
    };

    if (window.google) {
      initializeGoogleSignIn();
    } else {
      loadGoogleScript();
    }

    return () => {
      if (scriptTimer) clearTimeout(scriptTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, clientId, formType]);
  // removed onError/onSuccess from deps to avoid re-init loops if those functions aren't stable

  const handleCustomButtonClick = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  const handleFallbackAuth = async () => {
    try {
      const res = await getGoogleAuthUrl();
      if (res && res.url) {
        window.location.href = res.url;
      } else {
        onError?.('Google sign-in is currently unavailable');
      }
    } catch (e) {
      onError?.(e.message || 'Failed to start Google sign-in');
    }
  };

  // Render disabled state if script failed or not ready
  if (scriptFailed || !isGoogleReady) {
    return (
      <div className="w-full">
        <div className="w-full flex justify-center">
          <button
            type="button"
            onClick={scriptFailed ? handleFallbackAuth : undefined}
            disabled={!scriptFailed} // Disabled if just loading, enabled if failed (to allow fallback)
            className={`w-full rounded-xl border-2 border-gray-200 bg-white h-12 px-6 flex items-center justify-center gap-3 text-gray-500 transition-all shadow-sm ${scriptFailed ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-sm font-semibold tracking-wide">Sign in with Google</span>
          </button>
        </div>
      </div>
    );
  }

  // Active state
  return (
    <div className="w-full">
      <div id={`google-signin-button-${formType}`} className="w-full flex justify-center">
        <button
          type="button"
          id={`custom-google-button-${formType}`}
          onClick={handleCustomButtonClick}
          className="w-full rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 h-12 px-6 flex items-center justify-center gap-3 text-gray-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide">Sign in with Google</span>
        </button>
      </div>
    </div>
  );
};

export default GoogleLogin;