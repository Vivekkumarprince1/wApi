import { get, post } from './client';

/**
 * Wallet API - Manage pre-paid balance and transactions
 */
export const getWalletStatus = () => get('/billing/wallet/status');

export const getWalletTransactions = (params) => get('/billing/wallet/transactions', { params });

export const initiateRecharge = (amountPaise) => post('/billing/wallet/recharge/initiate', { amountPaise });

export const verifyRecharge = (paymentData) => post('/billing/wallet/recharge/verify', paymentData);
