import api from './client';

export interface BillingData {
  wallet: {
    balance: number;
    currency: string;
    status: string;
    thresholdAmount: number;
    isServiceDown?: boolean;
  };
  plan: {
    name: string;
    slug: string;
    limits: any;
    usage: any;
  };
  subscription: {
    autoPay: boolean;
    taxId: string;
    billingPivotDate?: string;
  };
  payment?: {
    enabled: boolean;
    provider: 'razorpay' | null;
  };
  transactions: any[];
}

export const fetchBillingInfo = async (): Promise<BillingData> => {
  // Proxied through main-server workspace controller
  return await api.get('/workspace/billing/info'); 
};

export const rechargeWallet = async (amount: number | { amountPaise: number }) => {
  const payload = typeof amount === 'number' ? { amount } : amount;
  return await api.post('/workspace/billing/recharge', payload);
};

export const verifyPayment = async (data: any) => {
  return await api.post('/workspace/billing/recharge/verify', data);
};

export const getWorkspacePricing = () =>
  api.get<any>('/workspace/pricing');

export const fetchBillingPlan = () =>
  api.get<any>('/workspace/billing/plan');

export const selectBillingPlan = (planSlug: string) =>
  api.post<any>('/workspace/billing/plan', { planSlug });

export const verifyBillingPlanPayment = (data: any) =>
  api.post<any>('/workspace/billing/plan/verify', data);

export const createPaymentMethodVerification = () =>
  api.post<any>('/workspace/billing/payment-method', {});

export const verifyPaymentMethod = (data: any) =>
  api.post<any>('/workspace/billing/payment-method/verify', data);

export const updateBillingSettings = (data: { autoPay?: boolean; taxId?: string }) =>
  api.patch<any>('/workspace/billing/settings', data);

export const getInvoiceDownloadUrl = (invoiceNumber: string) =>
  `/api/v1/workspace/billing/invoices/${invoiceNumber}/download`;
