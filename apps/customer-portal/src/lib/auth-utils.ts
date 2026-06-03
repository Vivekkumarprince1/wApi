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

export const clearAuthCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};
