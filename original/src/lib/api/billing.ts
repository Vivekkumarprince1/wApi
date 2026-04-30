import api from '@/lib/axios';

export interface BillingData {
  wallet: {
    balance: number;
    currency: string;
    status: string;
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
  return await api.get('/workspace/billing');
};
