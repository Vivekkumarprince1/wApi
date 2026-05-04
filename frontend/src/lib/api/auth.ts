import api from './client';

/**
 * AUTH API HELPERS
 * Paths match main-server /api/v1/auth/* (Next rewrites /api -> /api/v1).
 */

export const loginUser = async (data: any) => {
  return api.post('/auth/login', data);
};

/** Sends signup OTP; user must verify via verifySignupOtp or verifyOtpToken with purpose signup_email */
export const registerUser = async (userData: any) => {
  return api.post('/auth/signup', userData);
};

export const verifySignupOtp = async (email: string, otp: string) => {
  return api.post('/auth/verify-signup-otp', { email, otp });
};

export const getGoogleAuthUrl = async (formType: string = 'login') => {
  return api.get(`/auth/google/url?type=${formType}`);
};

export const facebookLogin = async (accessToken: string) => {
  return api.post('/auth/facebook', { accessToken });
};

export const logoutUser = async () => {
  return api.post('/auth/logout');
};

export const getCurrentUser = async () => {
  return api.get('/auth/me');
};

export const sendEmailVerificationOTP = (email?: string) =>
  api.post('/auth/otp/send', {
    purpose: 'email_verification',
    identifier: email || '',
  });

export const verifyEmailOTP = (otp: string, email?: string) =>
  api.post('/auth/otp/verify', {
    purpose: 'email_verification',
    identifier: email || '',
    otp,
  });

export const sendMobileVerificationOTP = (phone?: string) =>
  api.post('/auth/otp/send', {
    purpose: 'phone_verification',
    identifier: phone || '',
  });

export const verifyMobileVerificationOTP = (phone: string, otp: string) =>
  api.post('/auth/otp/verify', {
    purpose: 'phone_verification',
    identifier: phone,
    otp,
  });

export const requestPasswordReset = (data: any) =>
  api.post('/auth/request-password-reset', data);

export const resetPassword = (data: any) => api.post('/auth/reset-password', data);

export const updateCurrentUserProfile = (data: any) => api.patch('/auth/me', data);

export const sendOtp = (data: { purpose: string; identifier: string; [key: string]: any }) =>
  api.post('/auth/otp/send', data);

export const verifyOtpToken = (data: { purpose: string; identifier: string; otp: string }) =>
  api.post('/auth/otp/verify', data);
