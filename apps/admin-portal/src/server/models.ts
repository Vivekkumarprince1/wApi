import "server-only";
import {
  registerCoreModels,
  registerBillingModels,
  registerCampaignModels,
  registerAutomationModels,
  type CoreModels,
  type BillingModels,
  type CampaignModels,
  type AutomationModels,
} from "@wapi/database-models";
import { getConnection } from "./db";

/**
 * Shared models bound to the admin portal's cached connections. Schemas come
 * from @wapi/database-models (single source of truth); the portal never
 * redefines them.
 */
export async function coreModels(): Promise<CoreModels> {
  const conn = await getConnection("core");
  return registerCoreModels(conn);
}

export async function billingModels(): Promise<BillingModels> {
  const conn = await getConnection("billing");
  return registerBillingModels(conn);
}

export async function campaignModels(): Promise<CampaignModels> {
  const conn = await getConnection("campaign");
  return registerCampaignModels(conn);
}

export async function automationModels(): Promise<AutomationModels> {
  const conn = await getConnection("automation");
  return registerAutomationModels(conn);
}
