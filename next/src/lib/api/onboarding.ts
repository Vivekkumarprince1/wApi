import { get, post, put } from './client';

export const getOnboardingStatus = async () => {
  const response = await get('/onboarding/status');
  return response;
};

export const getVerificationStatus = async () => {
  const response = await get('/onboarding/verification-status');
  return response;
};

export const saveBusinessInfo = async (businessInfo: any) => {
  const response = await post('/onboarding/business-info', businessInfo);
  return response;
};

export const verifyBusinessDocument = async (payload: any) => {
  const response = await post('/onboarding/business-verification', payload);
  return response;
};

export const confirmBusiness = async (payload: any = {}) => {
  const response = await post('/onboarding/business-confirmation', payload);
  return response;
};

export const completeOnboarding = async () => {
  const response = await post('/onboarding/complete');
  return response;
};

// BSP Specific
export const bspStart = async (payload = {}, config = {}) => {
  const response = await post('/onboarding/bsp/start', payload, config);
  return response;
};

export const bspRegisterPhone = async (payload = {}) => {
  const response = await post('/onboarding/bsp/register-phone', payload);
  return response;
};

export const bspComplete = async (payload: any) => {
  const response = await post('/onboarding/bsp/complete', payload);
  return response;
};

export const bspStatus = async () => {
  const response = await get('/onboarding/bsp/status');
  return response;
};

export const bspRuntimeProfile = async () => {
  const response = await get('/onboarding/bsp/runtime-profile');
  return response;
};

export const bspSync = async () => {
  const response = await post('/onboarding/bsp/sync');
  return response;
};

export const bspDisconnect = async () => {
  const response = await post('/onboarding/bsp/disconnect');
  return response;
};
