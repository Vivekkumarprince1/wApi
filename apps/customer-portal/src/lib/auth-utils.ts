/**
 * FRONTEND AUTH UTILS
 * Safe utilities for client-side auth handling.
 */

export const getAuthToken = () => {
  if (typeof document === 'undefined') return null;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('auth_token='))
    ?.split('=')[1];
};

export const storeBrowserAuthToken = (token: string) => {
  if (typeof document === 'undefined' || !token) return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const maxAge = 7 * 24 * 60 * 60;
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
};

export const clearAuthCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};
