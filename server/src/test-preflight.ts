import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import { PreflightPolicyService } from './services/marketing/preflight-policy';

async function run() {
  console.log("Connecting to wa_saas MongoDB database at MONGODB_URI...");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in env variables!");
    process.exit(1);
  }
  
  await mongoose.connect(mongoUri);
  console.log("Connected successfully!");

  const workspaceId = '699c21048e96ba1b49ab6945';
  const templateId = '69dfc08a412780e450066c94';
  const contactsCount = 1;

  console.log("Input data for validation:", {
    workspaceId,
    templateId,
    contactsCount
  });

  try {
    console.log("Executing PreflightPolicyService.validate...");
    const result = await PreflightPolicyService.validate(
      workspaceId,
      templateId,
      contactsCount
    );
    console.log("Preflight validation result:", result);
  } catch (error: any) {
    console.error("CRITICAL PREFLIGHT VALIDATION ERROR DETECTED:", error);
    if (error.response) {
      console.error("Axios Response Data:", error.response.data);
      console.error("Axios Response Status:", error.response.status);
      console.error("Axios Response Headers:", error.response.headers);
    }
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run().catch(console.error);
