/**
 * AnswerBot Automation Verification Test
 * 
 * Tests:
 * 1. Fuzzy Matching (Keyword Overlap)
 * 2. Automated Response Delivery (Mocking bspMessagingService)
 * 3. Logging into AiIntentMatchLog
 */

const mongoose = require('mongoose');
const { FAQ, Conversation, Workspace, Contact, AiIntentMatchLog } = require('../src/models');
const answerbotService = require('../src/services/automation/answerbotService');
const bspMessagingService = require('../src/services/bsp/bspMessagingService');

// Mock bspMessagingService
let lastSentMessage = null;
bspMessagingService.sendTextMessage = async (workspaceId, to, text, options) => {
  console.log(`[MOCK] Sending Text to ${to}: ${text}`);
  lastSentMessage = { type: 'text', to, body: text, options };
  return { success: true, messageId: 'mock-wamid-123' };
};

bspMessagingService.sendInteractiveMessage = async (workspaceId, to, interactive, options) => {
  console.log(`[MOCK] Sending Interactive to ${to}: ${interactive.body.text}`);
  lastSentMessage = { type: 'interactive', to, body: interactive.body.text, options, buttons: interactive.action.buttons };
  return { success: true, messageId: 'mock-wamid-interactive' };
};

async function runTest() {
  try {
    console.log('🚀 Starting AnswerBot Automation Test...');
    
    // 1. Setup
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-saas');
    console.log('✅ Connected to MongoDB');

    // Pre-test cleanup
    await Contact.deleteMany({ phone: '919876543210' });
    
    const workspaceId = new mongoose.Types.ObjectId();
    
    // Create Contact (Required for Conversation middleware)
    const contact = await Contact.create({
      workspace: workspaceId,
      phone: '919876543210',
      name: 'Test Bot User'
    });
    const contactId = contact._id;
    console.log('✅ Contact Created');
    
    // Create FAQ
    const faq = await FAQ.create({
      workspace: workspaceId,
      question: 'How do I upgrade my plan?',
      answer: 'You can upgrade your plan in the settings dashboard.',
      variations: ['Upgrade plan', 'Change subscription'],
      status: 'approved',
      interactive: {
        buttons: [{ id: 'upgrade_now', title: 'Upgrade Now' }]
      }
    });
    console.log('✅ FAQ Created');

    // Create Conversation
    const conversation = await Conversation.create({
      workspace: workspaceId,
      contact: contactId,
      status: 'open',
      botMetadata: { failedIntents: 0 }
    });
    console.log('✅ Conversation Created');

    // 2. Test Fuzzy Match
    console.log('\n--- Test 1: Fuzzy Matching ---');
    const match1 = await answerbotService.matchFAQ('I want to upgrade my sub please', workspaceId, conversation);
    console.log('Match Result:', match1 ? 'FOUND' : 'NOT FOUND');
    if (match1 && match1.question.includes('upgrade')) {
      console.log('✅ Fuzzy Match Passed');
    } else {
      console.error('❌ Fuzzy Match Failed');
    }

    // 3. Test Automated Delivery
    console.log('\n--- Test 2: Automated Delivery ---');
    lastSentMessage = null;
    await answerbotService.processBotResponse('Tell me about plan upgrade', workspaceId, conversation);
    
    if (lastSentMessage && lastSentMessage.buttons) {
      console.log('✅ Interactive Delivery Passed');
      console.log('Sent Buttons:', JSON.stringify(lastSentMessage.buttons));
    } else {
      console.error('❌ Interactive Delivery Failed');
    }

    // 4. Test Match Logging
    console.log('\n--- Test 3: Audit Logging ---');
    const logs = await AiIntentMatchLog.find({ workspace: workspaceId });
    console.log('Logs found:', logs.length);
    if (logs.length > 0) {
      console.log('✅ Audit Logging Passed');
      console.log('Matched Query:', logs[0].queryText);
    } else {
      console.error('❌ Audit Logging Failed');
    }

    // Cleanup
    await FAQ.deleteMany({ workspace: workspaceId });
    await Conversation.deleteMany({ workspace: workspaceId });
    await AiIntentMatchLog.deleteMany({ workspace: workspaceId });
    console.log('\n✅ Cleanup Complete');

  } catch (err) {
    console.error('FATAL ERROR:', err);
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
}

runTest();
