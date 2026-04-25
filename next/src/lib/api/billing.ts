import api from '@/lib/axios';

export interface BillingData {
  wallet: {
    balance: number;
    currency: string;
    status: string;
  };
  plan: {
    name: string;
    limits: any;
    usage: any;
  };
  transactions: any[];
}

export const fetchBillingInfo = async (): Promise<BillingData> => {
  return await api.get('/workspace/billing');
};
