import { get, post, put } from './client';

export const getOnboardingStatus = async () => {
  const response = await get<any>('/onboarding/status');
  return response;
};

export const getVerificationStatus = async () => {
  const response = await get<any>('/onboarding/verification-status');
  return response;
};

export const saveBusinessInfo = async (businessInfo: any) => {
  const response = await post<any>('/onboarding/business-info', businessInfo);
  return response;
};

export const verifyBusinessDocument = async (payload: any) => {
  const response = await post<any>('/onboarding/business-verification', payload);
  return response;
};

export const confirmBusiness = async (payload: any = {}) => {
  const response = await post<any>('/onboarding/business-verification', payload);
  return response;
};

export const completeOnboarding = async () => {
  const response = await post<any>('/onboarding/complete');
  return response;
};

// BSP Specific
export const bspStart = async (payload = {}, config = {}) => {
  const response = await post<any>('/onboarding/bsp/start', payload, config);
  return response;
};

export const bspRegisterPhone = async (payload = {}) => {
  const response = await post<any>('/onboarding/bsp/register-phone', payload);
  return response;
};

export const bspComplete = async (payload: any) => {
  const response = await post<any>('/onboarding/bsp/complete', payload);
  return response;
};

export const bspStatus = async () => {
  const response = await get<any>('/onboarding/bsp/status');
  return response;
};

export const bspRuntimeProfile = async () => {
  const response = await get<any>('/onboarding/bsp/runtime-profile');
  return response;
};

export const bspSync = async () => {
  const response = await post<any>('/onboarding/bsp/sync');
  return response;
};

export const bspDisconnect = async () => {
  const response = await post<any>('/onboarding/bsp/disconnect');
  return response;
};
