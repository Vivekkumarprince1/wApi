const mongoose = require('mongoose');
const { Workspace, Contact, AutoReply, Template, Conversation, Message, AutoReplyLog } = require('../src/models');
const autoReplyService = require('../src/services/automation/autoReplyService');
const bspMessagingService = require('../src/services/bsp/bspMessagingService');
const templateSendingService = require('../src/services/template/templateSendingService');

async function testPhase3() {
  console.log('🚀 Starting Phase 3 Verification: Auto-Reply & Dynamic Variables');

  try {
    // 0. Pre-test Cleanup
    console.log('🧹 Cleaning up old test data...');
    await Contact.deleteMany({ phone: '919876543210' });
    
    // 1. Setup Mock Data
    const workspace = await Workspace.create({
      name: 'Test Workspace',
      settings: {}
    });
    const workspaceId = workspace._id;
    
    const contact = await Contact.create({
      workspace: workspaceId,
      phone: '919876543210',
      name: 'John Doe',
      customFields: new Map([['city', 'Bengaluru']])
    });

    const template = await Template.create({
      workspace: workspaceId,
      name: 'test_template',
      status: 'APPROVED',
      category: 'UTILITY',
      body: { text: 'Hello {{1}}, welcome from {{2}}!' }
    });

    // 2. Test Dynamic Variables (Template)
    console.log('\n--- 🧪 Test 2: Dynamic Variable Resolving ---');
    const autoReplyTemplate = await AutoReply.create({
      workspace: workspaceId,
      triggerType: 'keyword',
      keywords: ['hello'],
      replyType: 'template',
      template: template._id,
      variableMapping: [
        { variable: '1', contactField: 'name', fallbackValue: 'Customer' },
        { variable: '2', contactField: 'customFields.city', fallbackValue: 'your city' }
      ]
    });

    // Mock triggering message
    const msg = { _id: new mongoose.Types.ObjectId(), conversation: new mongoose.Types.ObjectId() };

    // We must mock services to avoid real API calls
    bspMessagingService.canSendSessionMessage = async () => false; // Force template
    
    // Mock templateSendingService
    templateSendingService.sendTemplate = async (params) => {
      console.log(`[Mock] templateSendingService.sendTemplate called`);
      console.log(`[Mock] Variables:`, JSON.stringify(params.variables, null, 2));
      return { success: true, messageId: 'msg_template_123' };
    };

    bspMessagingService.sendTemplateMessage = async (ws, to, name, lang, components) => {
      console.log(`[Mock] sendTemplateMessage called for ${name}`);
      console.log(`[Mock] Components:`, JSON.stringify(components, null, 2));
      return { data: { messageId: 'msg_template_123' } };
    };

    const res1 = await autoReplyService.sendAutoReply(autoReplyTemplate, contact, workspaceId, msg);
    console.log('Result 1 Success:', res1.success);

    // 3. Test Session Messaging (Text)
    console.log('\n--- 🧪 Test 3: Session (Free) Messaging ---');
    const autoReplyText = await AutoReply.create({
      workspace: workspaceId,
      triggerType: 'keyword',
      keywords: ['help'],
      replyType: 'text',
      textMessage: 'Hi {{name}}, how can we help you in {{customFields.city}}?'
    });

    bspMessagingService.canSendSessionMessage = async () => true; // Window is open
    bspMessagingService.sendTextMessage = async (ws, to, text) => {
      console.log(`[Mock] sendTextMessage called: "${text}"`);
      return { messageId: 'msg_text_123' };
    };

    const res2 = await autoReplyService.sendAutoReply(autoReplyText, contact, workspaceId, msg);
    console.log('Result 2 Success:', res2.success);

    // 4. Test Rule-Level Throttling
    console.log('\n--- 🧪 Test 4: Rule-Level Throttling ---');
    const check1 = await autoReplyService.checkAutoReply('hello', contact, workspaceId);
    console.log('Check 1 shouldSend (Hello):', check1.shouldSend); // Was just sent in Test 2, so should be FALSE for 24h

    const check2 = await autoReplyService.checkAutoReply('help', contact, workspaceId);
    console.log('Check 2 shouldSend (Help):', check2.shouldSend); // Was just sent in Test 3, so should be FALSE for 24h

    const autoReplyNew = await AutoReply.create({
      workspace: workspaceId,
      triggerType: 'keyword',
      keywords: ['new'],
      replyType: 'text',
      textMessage: 'New Rule'
    });

    const check3 = await autoReplyService.checkAutoReply('new', contact, workspaceId);
    console.log('Check 3 shouldSend (New Rule):', check3.shouldSend); // SHOULD BE TRUE because it's a different rule!

    console.log('\n✅ Phase 3 Verification Complete!');

  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    // Cleanup
    await mongoose.connection.close();
  }
}

// Minimal mongo connect to run script
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-saas').then(testPhase3);
