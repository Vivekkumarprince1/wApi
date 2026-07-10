import type { Connection, Model } from "mongoose";

import { buildUserSchema, type IUser } from "./schemas/user";
import { buildWorkspaceSchema, type IWorkspace } from "./schemas/workspace";
import { buildPlanSchema, type IPlan } from "./schemas/plan";
import { buildAuditLogSchema, type IAuditLog } from "./schemas/audit-log";
import { buildImpersonationLogSchema, type IImpersonationLog } from "./schemas/impersonation-log";
import { buildTemplateSchema, type ITemplate } from "./schemas/template";
import { buildSystemSettingsSchema, type ISystemSettings } from "./schemas/system-settings";
import { buildWebhookPolicySchema, type IWebhookPolicy } from "./schemas/webhook-policy";
import {
  buildWalletSchema,
  buildWalletTransactionSchema,
  buildSubscriptionSchema,
  buildInvoiceSchema,
  type IWallet,
  type IWalletTransaction,
  type ISubscription,
  type IInvoice,
} from "./schemas/billing";
import {
  buildCampaignSchema,
  buildAutomationRuleSchema,
  type ICampaign,
  type IAutomationRule,
} from "./schemas/operations";

export * from "./schemas/user";
export * from "./schemas/workspace";
export * from "./schemas/plan";
export * from "./schemas/audit-log";
export * from "./schemas/impersonation-log";
export * from "./schemas/template";
export * from "./schemas/system-settings";
export * from "./schemas/webhook-policy";
export * from "./schemas/billing";
export * from "./schemas/operations";
export type { SchemaCtor } from "./types";

/**
 * Models that live in the core (`wa_saas`) database.
 *
 * Bind them to a connection with `registerCoreModels(conn)`. The schemas are
 * compiled with the connection's own mongoose `Schema` class, so this package
 * works under both Mongoose 8 (core-server) and 9.6 (other services / the
 * admin portal) without forcing a version upgrade.
 */
export interface CoreModels {
  User: Model<IUser>;
  Workspace: Model<IWorkspace>;
  Plan: Model<IPlan>;
  AuditLog: Model<IAuditLog>;
  ImpersonationLog: Model<IImpersonationLog>;
  Template: Model<ITemplate>;
  SystemSettings: Model<ISystemSettings>;
  WebhookPolicy: Model<IWebhookPolicy>;
}

/** Returns an existing compiled model on the connection, or compiles it once. */
function modelOnce<T>(
  conn: Connection,
  name: string,
  build: (SchemaCtor: typeof import("mongoose").Schema) => import("mongoose").Schema<T>
): Model<T> {
  const existing = conn.models[name] as Model<T> | undefined;
  if (existing) return existing;
  // The connection's base exposes the matching Schema constructor.
  const SchemaCtor = (conn.base as unknown as { Schema: typeof import("mongoose").Schema }).Schema;
  return conn.model<T>(name, build(SchemaCtor));
}

export function registerCoreModels(conn: Connection): CoreModels {
  return {
    User: modelOnce<IUser>(conn, "User", buildUserSchema),
    Workspace: modelOnce<IWorkspace>(conn, "Workspace", buildWorkspaceSchema),
    Plan: modelOnce<IPlan>(conn, "Plan", buildPlanSchema),
    AuditLog: modelOnce<IAuditLog>(conn, "AuditLog", buildAuditLogSchema),
    ImpersonationLog: modelOnce<IImpersonationLog>(conn, "ImpersonationLog", buildImpersonationLogSchema),
    Template: modelOnce<ITemplate>(conn, "Template", buildTemplateSchema),
    SystemSettings: modelOnce<ISystemSettings>(conn, "SystemSettings", buildSystemSettingsSchema),
    WebhookPolicy: modelOnce<IWebhookPolicy>(conn, "WebhookPolicy", buildWebhookPolicySchema),
  };
}

/** Models that live in the billing database (`connectsphere_billing`). */
export interface BillingModels {
  Wallet: Model<IWallet>;
  WalletTransaction: Model<IWalletTransaction>;
  Subscription: Model<ISubscription>;
  Invoice: Model<IInvoice>;
}

export function registerBillingModels(conn: Connection): BillingModels {
  return {
    Wallet: modelOnce<IWallet>(conn, "Wallet", buildWalletSchema),
    WalletTransaction: modelOnce<IWalletTransaction>(conn, "WalletTransaction", buildWalletTransactionSchema),
    Subscription: modelOnce<ISubscription>(conn, "Subscription", buildSubscriptionSchema),
    Invoice: modelOnce<IInvoice>(conn, "Invoice", buildInvoiceSchema),
  };
}

/** Models in the campaign database (`wa_campaigns`). */
export interface CampaignModels {
  Campaign: Model<ICampaign>;
}

export function registerCampaignModels(conn: Connection): CampaignModels {
  return { Campaign: modelOnce<ICampaign>(conn, "Campaign", buildCampaignSchema) };
}

/** Models in the automation database (`connectsphere_automation`). */
export interface AutomationModels {
  AutomationRule: Model<IAutomationRule>;
}

export function registerAutomationModels(conn: Connection): AutomationModels {
  return { AutomationRule: modelOnce<IAutomationRule>(conn, "AutomationRule", buildAutomationRuleSchema) };
}
