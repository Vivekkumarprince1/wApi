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
  transactions: any[];
}

export const fetchBillingInfo = async (): Promise<BillingData> => {
  // Proxied through main-server workspace controller
  return await api.get('/workspace/billing/info'); 
};

export const rechargeWallet = async (amount: number) => {
  return await api.post('/workspace/billing/recharge', { amount });
};

export const verifyPayment = async (data: any) => {
  return await api.post('/workspace/billing/recharge/verify', data);
};

export const getInvoiceDownloadUrl = (invoiceNumber: string) =>
  `/api/v1/workspace/billing/invoices/${invoiceNumber}/download`;

