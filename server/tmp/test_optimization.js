const mongoose = require('mongoose');
const { processCampaignStatusUpdate } = require('../server/src/services/campaign/campaignWebhookService');
const { Campaign, CampaignMessage, Message, Contact, Workspace } = require('../server/src/models');

async function testOptimization() {
  try {
    // 1. Setup Mock Data
    const workspaceId = new mongoose.Types.ObjectId();
    const campaignId = new mongoose.Types.ObjectId();
    const contactId = new mongoose.Types.ObjectId();
    const messageId = new mongoose.Types.ObjectId();
    const wamid = 'wamid.' + Math.random().toString(36).substring(7);

    // Create a mock campaign with optimization
    await Campaign.create({
      _id: campaignId,
      workspace: workspaceId,
      name: 'Test Optimization Campaign',
      deliveryOptimization: {
        enabled: true,
        type: 'AUTOMATED_RETRY',
        retryConfig: { maxAttempts: 3, retryDelayHours: 24 }
      },
      status: 'RUNNING',
      totals: { totalRecipients: 1, sent: 0, failed: 0 }
    });

    // Create a mock message
    await Message.create({
      _id: messageId,
      workspace: workspaceId,
      contact: contactId,
      whatsappMessageId: wamid,
      meta: { campaignId }
    });

    // Create a mock campaign message
    await CampaignMessage.create({
        workspace: workspaceId,
        campaign: campaignId,
        message: messageId,
        contact: contactId,
        whatsappMessageId: wamid,
        status: 'sending'
    });

    console.log('--- Mock Data Ready ---');

    // 2. Simulate Frequency Cap Failure Webhook
    const statusData = {
      errors: [{ code: 131026, message: 'Frequency cap reached' }]
    };

    console.log('--- Simulating Status Update (Failure) ---');
    const result = await processCampaignStatusUpdate(wamid, 'failed', new Date(), statusData);
    
    console.log('Result:', JSON.stringify(result, null, 2));

    // 3. Verify CampaignMessage status changed to RETRIED
    const updatedMsg = await CampaignMessage.findOne({ campaign: campaignId, contact: contactId });
    console.log('Updated Status:', updatedMsg.status);

    if (updatedMsg.status === 'RETRIED') {
        console.log('✅ PASS: Message marked for retry.');
    } else {
        console.log('❌ FAIL: Message not marked as RETRIED.');
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
}

// Connect and run
mongoose.connect('mongodb://localhost:27017/wapi_local').then(testOptimization);
