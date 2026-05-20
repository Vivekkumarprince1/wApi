import type { ApiResponse, ObjectIdString } from './common';

export type BillingChargeCategory =
  | 'MARKETING'
  | 'UTILITY'
  | 'AUTHENTICATION'
  | 'SERVICE'
  | 'SESSION'
  | 'SUBSCRIPTION'
  | 'COMMERCE';

export interface BillingPreflightRequest {
  workspaceId: ObjectIdString;
  category: BillingChargeCategory;
  units?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingPreflightResult {
  allowed: boolean;
  cost: number;
  currency: string;
  walletBalance?: number;
  reason?: string;
}

export type BillingPreflightResponse = ApiResponse<BillingPreflightResult>;

export interface BillingReservationRequest {
  workspaceId: ObjectIdString;
  category: BillingChargeCategory;
  amount: number;
  currency: string;
  referenceType: 'message' | 'campaign' | 'subscription' | 'order' | 'provider_event';
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingReservationResult {
  reservationId: ObjectIdString;
  status: 'reserved' | 'rejected';
  amount: number;
  currency: string;
  reason?: string;
}

export type BillingReservationResponse = ApiResponse<BillingReservationResult>;

export interface BillingSettleReservationRequest {
  reservationId: ObjectIdString;
  providerMessageId?: string;
  finalAmount?: number;
  metadata?: Record<string, unknown>;
}

export interface BillingReleaseReservationRequest {
  reservationId: ObjectIdString;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface BillingReservationFinalResult {
  reservationId: ObjectIdString;
  transactionId?: ObjectIdString;
  status: 'settled' | 'released';
  amount: number;
  currency: string;
}

export type BillingReservationFinalResponse = ApiResponse<BillingReservationFinalResult>;
