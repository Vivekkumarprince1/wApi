"use client";

import { useEffect } from 'react';

export default function GlobalErrorHandler() {
  useEffect(() => {
    // Suppress cross-origin script errors from showing the React dev overlay
    const onError = (event) => {
      try {
        // If it's a cross-origin / script error, message is often 'Script error.' and filename is empty
        const msg = event?.message || '';
        const filename = event?.filename || '';

        // If it's likely a cross-origin error, prevent default overlay and log a friendly message
        if (msg === 'Script error.' || filename.includes('connect.facebook.net') || filename.includes('accounts.google.com')) {
          console.warn('Cross-origin script error suppressed:', { message: msg, filename });
          event.preventDefault();
          return true;
        }
      } catch (e) {
        // ignore
      }
      // Do not prevent other errors
      return false;
    };

    const onUnhandledRejection = (event) => {
      try {
        const reason = event?.reason;
        const msg = (reason && reason.message) ? reason.message : String(reason);
        if (msg === 'Script error.' || msg.includes('Script error')) {
          console.warn('Cross-origin promise rejection suppressed:', reason);
          event.preventDefault();
          return true;
        }
      } catch (e) {
        // ignore
      }
      return false;
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
