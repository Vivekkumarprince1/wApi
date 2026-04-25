import { get, post } from './client';

/**
 * Subscription API - Manage recurring billing plans
 */

export const getPlans = () => get('/billing/plans');

export const getSubscriptionStatus = () => get('/billing/subscriptions/status');

export const createSubscription = (planId, billingCycle = 'monthly') => 
  post('/billing/subscriptions/create', { planId, billingCycle });

export const verifySubscription = (paymentData) => 
  post('/billing/subscriptions/verify', paymentData);

export const simulateMockSuccess = (subscriptionId) => 
  post('/billing/subscriptions/simulate-success', { subscriptionId });
