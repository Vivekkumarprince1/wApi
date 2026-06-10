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
} from "./db-models";
import { getConnection } from "./db";

/**
 * Models bound to the admin portal's cached connections. Schemas live locally
 * under ./db-models (single source of truth for the portal); they are not
 * shared with backend services.
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
