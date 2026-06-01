import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import { Campaign } from './models/Campaign';

async function run() {
  const uri = process.env.MONGODB_URI_CAMPAIGN || 'mongodb://localhost:27017/wa_campaigns';
  console.log("Connecting to MongoDB database at:", uri.replace(/:([^@:]+)@/, ':***@'));
  await mongoose.connect(uri);
  console.log("Connected successfully!");

  const campaignId = '6a1c8776e9402038625a32f1';
  console.log(`Searching for Campaign ${campaignId}...`);
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    console.error("Campaign not found in database!");
    process.exit(1);
  }

  console.log("Campaign loaded successfully:");
  console.log(JSON.stringify({
    _id: campaign._id,
    name: campaign.name,
    workspace: campaign.workspace,
    template: campaign.template,
    contactsCount: campaign.contacts?.length
  }, null, 2));

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

run().catch(console.error);
