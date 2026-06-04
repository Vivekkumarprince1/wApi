import "server-only";
import { getConnection } from "./db";
import * as Models from "./models/index";

export async function coreModels(): Promise<any> {
  await getConnection("core");
  return Models;
}

export async function billingModels(): Promise<any> {
  await getConnection("billing");
  return Models; 
}

export async function campaignModels(): Promise<any> {
  await getConnection("campaign");
  return Models; 
}

export async function automationModels(): Promise<any> {
  await getConnection("automation");
  return Models; 
}
