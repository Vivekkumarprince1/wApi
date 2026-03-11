/**
 * COMPREHENSIVE CLEANUP SCRIPT
 * 
 * 1. Deletes all local database records for:
 *    - Templates & Template Metrics
 *    - Messages, Conversations, Ledgers
 *    - Campaign status & messages
 * 2. Deletes all templates from Meta (Gupshup) platform for all workspaces
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Import models
const { 
  Template, 
  TemplateMetric, 
  Message, 
  Conversation, 
  ConversationLedger, 
  CampaignMessage, 
  CampaignBatch, 
  CampaignSummary,
  Workspace
} = require('../src/models');

const gupshupService = require('../src/services/bsp/gupshupService');

async function clearAllData() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('ERROR: MONGODB_URI not found in .env');
      process.exit(1);
    }

    console.log('--- STARTING COMPREHENSIVE CLEANUP ---');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected successfully.\n');

    // --- 1. LOCAL DATABASE CLEANUP ---
    console.log('[1/2] LOCAL DATABASE CLEANUP');
    
    const collections = [
      { model: Template, name: 'Templates' },
      { model: TemplateMetric, name: 'TemplateMetrics' },
      { model: Message, name: 'Messages' },
      { model: Conversation, name: 'Conversations' },
      { model: ConversationLedger, name: 'ConversationLedgers' },
      { model: CampaignMessage, name: 'CampaignMessages' },
      { model: CampaignBatch, name: 'CampaignBatches' },
      { model: CampaignSummary, name: 'CampaignSummaries' }
    ];

    for (const col of collections) {
      console.log(`Deleting ${col.name}...`);
      const result = await col.model.deleteMany({});
      console.log(`Successfully deleted ${result.deletedCount} ${col.name}.`);
    }

    // --- 2. META (GUPSHUP) CLEANUP ---
    console.log('\n[2/2] META (GUPSHUP) CLEANUP');
    
    const workspaces = await Workspace.find({ 
      $or: [
        { gupshupAppId: { $ne: null } },
        { 'gupshupIdentity.partnerAppId': { $ne: null } }
      ]
    }).lean();

    console.log(`Found ${workspaces.length} workspaces with Gupshup configurations.`);

    for (const ws of workspaces) {
      const appId = ws.gupshupIdentity?.partnerAppId || ws.gupshupAppId;
      const appApiKey = ws.gupshupIdentity?.appApiKey;

      if (!appId || !appApiKey) {
        console.log(`Skipping workspace "${ws.name}" - Missing credentials.`);
        continue;
      }

      console.log(`\nProcessing Workspace: "${ws.name}" (AppId: ${appId})`);
      
      try {
        console.log(`Fetching templates from Gupshup...`);
        const response = await gupshupService.listTemplates({ 
          appId, 
          appApiKey, 
          pageSize: 500 
        });

        const templates = response.templates || [];
        console.log(`Found ${templates.length} templates on Gupshup.`);

        for (const t of templates) {
          const elementName = t.elementName || t.name;
          if (!elementName) continue;

          try {
            console.log(`Deleting template "${elementName}" from Gupshup...`);
            await gupshupService.deleteTemplateForApp({
              appId,
              appApiKey,
              elementName
            });
            console.log(`Successfully deleted "${elementName}"`);
          } catch (delErr) {
            console.error(`Failed to delete "${elementName}": ${delErr.message}`);
          }
        }
      } catch (listErr) {
        console.error(`Failed to list templates for workspace "${ws.name}": ${listErr.message}`);
      }
    }

    console.log('\n--- CLEANUP COMPLETE ---');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('\nCRITICAL ERROR:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

clearAllData();
