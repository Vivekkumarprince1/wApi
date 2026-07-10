import type { Schema as SchemaType, Types } from "mongoose";
import type { SchemaCtor } from "../types";

/* Schemas for the billing database (connectsphere_billing). Mirror billing-service's
 * persistence layer (services/billing-service/src/models/index.ts). Focused +
 * strict:false so owner-service fields round-trip. Read-only from the portal. */

export interface IWallet {
  workspaceId: Types.ObjectId;
  availableBalance: number;
  parkedBalance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWalletTransaction {
  workspaceId: Types.ObjectId;
  amount: number;
  type: string;
  newBalance: number;
  description: string;
  status: string;
  createdAt: Date;
}

export interface ISubscription {
  workspaceId: Types.ObjectId;
  planId: Types.ObjectId;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvoice {
  workspaceId: Types.ObjectId;
  status: string;
  totalCents: number;
  currency: string;
  billingPeriod?: string;
  issuedAt?: Date;
  paidAt?: Date;
  invoiceNumber?: string;
  createdAt: Date;
}

export function buildWalletSchema(Schema: SchemaCtor): SchemaType<IWallet> {
  return new Schema<IWallet>(
    {
      workspaceId: { type: Schema.Types.ObjectId, index: true },
      availableBalance: { type: Number, default: 0 },
      parkedBalance: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    { strict: false, collection: "wallets", timestamps: true }
  );
}

export function buildWalletTransactionSchema(Schema: SchemaCtor): SchemaType<IWalletTransaction> {
  return new Schema<IWalletTransaction>(
    {
      workspaceId: { type: Schema.Types.ObjectId, index: true },
      amount: { type: Number },
      type: { type: String, index: true },
      newBalance: { type: Number },
      description: { type: String },
      status: { type: String },
    },
    { strict: false, collection: "wallettransactions", timestamps: { createdAt: true, updatedAt: false } }
  );
}

export function buildSubscriptionSchema(Schema: SchemaCtor): SchemaType<ISubscription> {
  return new Schema<ISubscription>(
    {
      workspaceId: { type: Schema.Types.ObjectId, index: true },
      planId: { type: Schema.Types.ObjectId },
      status: { type: String },
      currentPeriodStart: { type: Date },
      currentPeriodEnd: { type: Date },
    },
    { strict: false, collection: "subscriptions", timestamps: true }
  );
}

export function buildInvoiceSchema(Schema: SchemaCtor): SchemaType<IInvoice> {
  return new Schema<IInvoice>(
    {
      workspaceId: { type: Schema.Types.ObjectId, index: true },
      status: { type: String },
      totalCents: { type: Number },
      currency: { type: String, default: "INR" },
      billingPeriod: { type: String },
      issuedAt: { type: Date },
      paidAt: { type: Date },
      invoiceNumber: { type: String },
    },
    { strict: false, collection: "invoices", timestamps: true }
  );
}
