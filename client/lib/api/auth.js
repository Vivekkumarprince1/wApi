import { API_URL, getAuthHeaders, post, put, del } from './client';

export const sendSignupOTP = async (userData) => {
  const response = await fetch(`${API_URL}/auth/send-signup-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(userData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send OTP');
  }
  return response.json();
};

export const verifySignupOTP = async (otpData) => {
  const response = await fetch(`${API_URL}/auth/verify-signup-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(otpData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify OTP');
  }
  const data = await response.json();
  if (data.token) localStorage.setItem('token', data.token);
  return data;
};

export const sendLoginOTP = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/send-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send OTP');
  }
  return response.json();
};

export const verifyLoginOTP = async (otpData) => {
  const response = await fetch(`${API_URL}/auth/verify-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(otpData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify OTP');
  }
  const data = await response.json();
  if (data.token) localStorage.setItem('token', data.token);
  return data;
};

export const registerUser = async (userData) => {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(userData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to register');
  }
  const data = await response.json();
  if (data.token) localStorage.setItem('token', data.token);
  return data;
};

export const loginUser = async (credentials) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to login');
  }
  const data = await response.json();
  if (data.token) localStorage.setItem('token', data.token);
  return data;
};

export const logoutUser = async () => {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to logout');
    }
    return response.json();
  } finally {
    localStorage.removeItem('token');
  }
};

export const getCurrentUser = async () => {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      return null;
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user');
  }
  const data = await response.json();
  return data.user;
};

export const updateProfile = async (profileData) => {
  const response = await fetch(`${API_URL}/auth/update-profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(profileData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update profile');
  }
  const data = await response.json();
  return data.user;
};

export const googleLogin = async (token) => {
  const response = await fetch(`${API_URL}/auth/google/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Google authentication failed');
  }
  const data = await response.json();
  if (data.token) localStorage.setItem('token', data.token);
  return data;
};

export const getGoogleAuthUrl = async () => {
  return fetch(`${API_URL}/auth/google/auth-url`, { credentials: 'include' })
    .then(res => res.json());
};

export const verifyGoogleOTP = async (data) => {
  return post('/auth/google/verify-otp', data);
};

export const facebookLogin = async (accessToken) => {
  const response = await fetch(`${API_URL}/auth/facebook/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accessToken }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Facebook authentication failed');
  }
  const data = await response.json();
  if (data.token) localStorage.setItem('token', data.token);
  return data;
};

export const sendEmailVerificationOTP = async () => {
  return post('/auth/send-email-verification', {});
};

export const verifyEmailOTP = async (otp) => {
  return post('/auth/verify-email', { otp });
};

export const deleteAccount = async () => {
  return del('/privacy/delete-account');
};
