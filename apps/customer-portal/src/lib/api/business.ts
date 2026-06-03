import { get, post, put } from './client';

export const saveBusinessInfo = async (businessInfo: any) => {
  const response = await post<any>('/business/info', businessInfo);
  return response;
};

export const verifyBusinessDocument = async (payload: any) => {
  const response = await post<any>('/business/verify', payload);
  return response;
};

export const confirmBusiness = async (payload: any = {}) => {
  const response = await post<any>('/business/verify', payload);
  return response;
};
