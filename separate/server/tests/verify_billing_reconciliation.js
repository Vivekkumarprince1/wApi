const mongoose = require('mongoose');
const { Workspace, Contact, Campaign, ConversationLedger, CampaignMessage, Message } = require('../src/models');
const walletService = require('../src/services/workspace/walletService');
const billingLedgerService = require('../src/services/billing/billingLedgerService');
const campaignWebhookService = require('../src/services/campaign/campaignWebhookService');

// Setup MongoDB Connection
const MONGO_URI = 'mongodb://localhost:27017/wapi_audit_test';

async function runTest() {
  console.log('🚀 Starting Billing Reconciliation Test...');
  try {
    await mongoose.connect(MONGO_URI);

    // 1. Setup Data
    const workspaceId = new mongoose.Types.ObjectId();
    const contactId = new mongoose.Types.ObjectId();
    const campaignId = new mongoose.Types.ObjectId();
    const conversationId = new mongoose.Types.ObjectId();
    const wamid1 = 'wamid12345';
    const wamid2 = 'wamid67890';

    await Workspace.create({
      _id: workspaceId,
      name: 'Test Workspace',
      wallet: { balance: 10, parkedBalance: 0, currency: 'USD' }
    });

    await Contact.create({
      _id: contactId,
      workspace: workspaceId,
      phone: '919876543210'
    });

    console.log('✅ Setup Workspace and Contact');

    // 2. Simulate Campaign Launch (Park 2 credits for 2 hypothetical sends)
    await walletService.parkBalance(workspaceId, 2, campaignId);
    let ws = await Workspace.findById(workspaceId);
    console.log(`💰 Credits Parked. Balance: ${ws.wallet.balance}, Parked: ${ws.wallet.parkedBalance}`);

    // 3. First Send (Should start window and SPEND credit)
    console.log('\n--- First Send Simulation ---');
    await billingLedgerService.startBusinessConversation({
      workspaceId,
      conversationId,
      contactId,
      phoneNumber: '919876543210',
      templateCategory: 'MARKETING',
      whatsappMessageId: wamid1,
      messageId: new mongoose.Types.ObjectId()
    });

    // Simulate Webhook status 'sent'
    await Message.create({
      workspace: workspaceId,
      contact: contactId,
      whatsappMessageId: wamid1,
      direction: 'outbound',
      meta: { campaignId }
    });

    const res1 = await campaignWebhookService.processCampaignStatusUpdate(wamid1, 'sent', new Date());
    console.log(`[Test] Webhook Res 1: ${JSON.stringify(res1)}`);
    
    // Wait for setImmediate
    await new Promise(r => setTimeout(r, 500));

    ws = await Workspace.findById(workspaceId);
    console.log(`💰 Result 1: Balance: ${ws.wallet.balance}, Parked: ${ws.wallet.parkedBalance}`);

    // 4. Second Send within 24h (Should REUSE window and REFUND credit)
    console.log('\n--- Second Send Simulation (Within 24h) ---');
    await billingLedgerService.startBusinessConversation({
      workspaceId,
      conversationId,
      contactId,
      phoneNumber: '919876543210',
      templateCategory: 'MARKETING',
      whatsappMessageId: wamid2,
      messageId: new mongoose.Types.ObjectId()
    });

    await Message.create({
      workspace: workspaceId,
      contact: contactId,
      whatsappMessageId: wamid2,
      direction: 'outbound',
      meta: { campaignId }
    });

    const res2 = await campaignWebhookService.processCampaignStatusUpdate(wamid2, 'sent', new Date());
    console.log(`[Test] Webhook Res 2: ${JSON.stringify(res2)}`);
    
    await new Promise(r => setTimeout(r, 500));

    ws = await Workspace.findById(workspaceId);
    console.log(`💰 Result 2: Balance: ${ws.wallet.balance}, Parked: ${ws.wallet.parkedBalance}`);

    if (ws.wallet.balance === 9 && ws.wallet.parkedBalance === 0) {
      console.log('\n🌟 SUCCESS: Conversation-aware billing is working perfectly!');
    } else {
      console.log('\n❌ FAILURE: Reconciliation counts mismatch');
      console.log(`Actual Balance: ${ws.wallet.balance}, Parked: ${ws.wallet.parkedBalance}`);
      console.log('Expected Balance: 9, Parked: 0');
    }

  } catch (err) {
    console.error('Test errored:', err);
  } finally {
    // Cleanup
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTest();
