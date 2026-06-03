import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { HealthService } from '../services/health-service';
import dbConnect from '../db-connect';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function run() {
  console.log("Checking Queue monitoring health preflight...");
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn("REDIS_URL not found in env! Using default redis://localhost:6379");
    }

    console.log("Running HealthService.checkQueues()...");
    const queueDepthReport = await HealthService.checkQueues();
    console.log("Queue Probe Results:", JSON.stringify(queueDepthReport, null, 2));

    const allOk = queueDepthReport.every(q => q.waiting >= 0);
    if (allOk) {
      console.log("✓ Success: All queue probes connected and fetched metrics successfully!");
      process.exit(0);
    } else {
      console.error("❌ Error: Some queue probes failed or returned invalid results.");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("Fatal preflight verification error:", error.message);
    process.exit(1);
  }
}

run();
