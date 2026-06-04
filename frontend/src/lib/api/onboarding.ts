import { get, post, put } from './client';

const unwrap = (response: any) => response?.data ?? response;

export const getOnboardingStatus = async () => {
  const response = await get<any>('/onboarding/status');
  return unwrap(response);
};

// bsp-service exposes onboarding state (incl. verification) under /onboarding/status.
export const getVerificationStatus = async () => {
  const response = await get<any>('/onboarding/status');
  return unwrap(response);
};

export const completeOnboarding = async () => {
  const response = await post<any>('/onboarding/complete');
  return unwrap(response);
};

// BSP Specific
export const bspStart = async (payload = {}, config = {}) => {
  const response = await post<any>('/onboarding/bsp/start', payload, config);
  return unwrap(response);
};

export const bspRegisterPhone = async (payload = {}) => {
  const response = await post<any>('/onboarding/bsp/register-phone', payload);
  return unwrap(response);
};

export const bspComplete = async (payload: any) => {
  const response = await post<any>('/onboarding/bsp/complete', payload);
  return unwrap(response);
};

export const bspStatus = async () => {
  const response = await get<any>('/onboarding/bsp/status');
  return unwrap(response);
};

export const bspRuntimeProfile = async () => {
  const response = await get<any>('/onboarding/bsp/runtime-profile');
  return unwrap(response);
};

export const bspSync = async () => {
  const response = await post<any>('/onboarding/bsp/sync');
  return unwrap(response);
};

export const bspDisconnect = async () => {
  const response = await post<any>('/onboarding/bsp/disconnect');
  return unwrap(response);
};
