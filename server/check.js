require('dotenv').config();
const mongoose = require('mongoose');
const { Campaign, Template, Contact, CampaignBatch } = require('./src/models');
const { startCampaignWorker, processCampaignStart, processBatch } = require('./src/services/campaign/campaignWorkerService');
const { campaignQueue, JOB_TYPES } = require('./src/services/campaign/campaignQueueService');

async function test() {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    
    // Clean up
    await CampaignBatch.deleteMany({});
    
    // Reset campaign
    const campaign = await Campaign.findOne({ name: 'sale' });
    campaign.status = 'queued';
    // Make sure it has contacts
    const contact = await Contact.findOne();
    campaign.contacts = [contact._id];
    await campaign.save();
    
    console.log('--- STARTING CAMPAIGN START JOB ---');
    const startResult = await processCampaignStart({
      data: { campaignId: campaign._id, workspaceId: campaign.workspace }
    });
    console.log('Start Result:', startResult);
    
    console.log('--- WAITING FOR BATCH ---');
    const batches = await CampaignBatch.find({ campaign: campaign._id });
    console.log('Batches found in DB:', batches.length);
    
    if (batches.length > 0) {
      console.log('--- MANUALLY PROCESSING BATCH ---');
      const batchResult = await processBatch({
        data: {
          batchId: batches[0]._id,
          campaignId: campaign._id,
          workspaceId: campaign.workspace,
          batchIndex: batches[0].batchIndex
        }
      });
      console.log('Batch Result:', batchResult);
    }
    
  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    setTimeout(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }, 2000);
  }
}
test();
