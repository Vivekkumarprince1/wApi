import { get, post, put, del, patch } from './client';

export const registerUser = async (userData: any) => {
  const response = await post('/auth/signup', userData);
  return response;
};

export const loginUser = async (credentials: any) => {
  const response = await post('/auth/login', credentials);
  return response;
};

export const logoutUser = async () => {
  const response = await get('/auth/logout');
  return response;
};

export const getCurrentUser = async () => {
  try {
    const response = await get('/auth/session');
    return response;
  } catch (err: any) {
    if (err.response?.status === 401) {
      return null;
    }
    throw err;
  }
};

export const updateCurrentUserProfile = async (profileData: {
  name?: string;
  phone?: string;
  timezone?: string;
}) => {
  const response = await patch('/auth/me', profileData);
  return response;
};


export const requestPasswordReset = async (email: string) => {
  const response = await post('/auth/request-password-reset', { email });
  return response;
};

export const resetPassword = async (data: any) => {
  const response = await post('/auth/reset-password', data);
  return response;
};

export const getGoogleAuthUrl = async () => {
  // Always hit same-origin API to avoid browser-level connection refused errors.
  const response = await get('/auth/google/auth-url');
  return response;
};

export const googleLogin = async (token: string) => {
  const response = await post('/auth/google/login', { token });
  return response;
};

export const facebookLogin = async (accessToken: string) => {
  const response = await post('/auth/facebook/login', { accessToken });
  return response;
};

// --- OTP / LOGIN / VERIFICATION ---

/**
 * Common OTP request (Unified backend /api/auth/otp/send)
 */
export const sendOtp = async (data: { purpose: string; identifier: string; [key: string]: any }) => {
  const response = await post('/auth/otp/send', data);
  return response;
};

/**
 * Common OTP verification (Unified backend /api/auth/otp/verify)
 */
export const verifyOtpToken = async (data: { purpose: string; identifier: string; otp: string }) => {
  const response = await post('/auth/otp/verify', data);
  return response;
};

// Named Aliases for Onboarding/Login compatibility
export const sendPhoneLoginOTP = (phone: string) => sendOtp({ purpose: 'phone_login', identifier: phone });
export const verifyPhoneLoginOTP = (phone: string, otp: string) => verifyOtpToken({ purpose: 'phone_login', identifier: phone, otp });

export const sendEmailLoginOTP = (email: string) => sendOtp({ purpose: 'email_login', identifier: email });
export const verifyEmailLoginOTP = (email: string, otp: string) => verifyOtpToken({ purpose: 'email_login', identifier: email, otp });

export const sendEmailVerificationOTP = (email: string) => sendOtp({ purpose: 'email_verification', identifier: email });
export const verifyEmailOTP = (otp: string) => verifyOtpToken({ purpose: 'email_verification', identifier: '', otp }); // identifier handled by session in backend

export const sendMobileVerificationOTP = (phone: string) => sendOtp({ purpose: 'phone_verification', identifier: phone });
export const verifyMobileVerificationOTP = (phone: string, otp: string) => verifyOtpToken({ purpose: 'phone_verification', identifier: phone, otp });

// Cleanup legacy
export const verifyEmailOtp = verifyEmailOTP;
export const resendEmailOtp = sendEmailVerificationOTP;

// Signup compatibility
export const sendSignupEmailOTP = registerUser;
export const verifySignupEmailOTP = async (email: string, otp: string) => {
  // Legacy signup verify endpoint expects an object with email and otp
  const response = await post('/auth/verify-signup-otp', { email, otp });
  return response;
};

