require('dotenv').config();
const mongoose = require('mongoose');
const { Campaign } = require('./src/models');
const { processCampaignStart } = require('./src/services/campaign/campaignWorkerService');

async function test() {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    
    const campaign = await Campaign.findOne({ name: 'sale' });
    if (!campaign) {
      console.log('Campaign not found');
      return;
    }
    
    // reset campaign to allow it to run
    campaign.status = 'queued';
    await campaign.save();
    console.log('Campaign reset to queued.');
    
    console.log('Running processCampaignStart...');
    const result = await processCampaignStart({
      data: { campaignId: campaign._id, workspaceId: campaign.workspace }
    });
    console.log('processCampaignStart Result:', result);
    
  } catch (err) {
    console.error('Error in processCampaignStart:', err);
  } finally {
    // leave connection open for a moment so BullMQ can finish network requests
    setTimeout(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }, 2000);
  }
}
test();
