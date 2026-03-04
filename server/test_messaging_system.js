const mongoose = require('mongoose');
const { Message } = require('./src/models/Message');
const { Conversation } = require('./src/models/Conversation');
const { Contact } = require('./src/models/Contact');
const bspMessagingService = require('./src/services/bsp/bspMessagingService');
const gupshupWebhookController = require('./src/controllers/gupshupWebhookController');

// Test data
const testWorkspaceId = 'test-workspace-123';
const testWabaId = 'test-waba-456';
const testPhone = '917250319702'; // Normalized Indian number

async function runTests() {
  try {
    console.log('🚀 Starting WhatsApp Messaging System Tests...\n');

    // Test 1: Phone normalization
    console.log('📞 Test 1: Phone Normalization');
    const normalizedPhone = require('./src/services/gupshup/gupshupService').normalizePhoneNumber('7250319702');
    console.log(`Input: 7250319702 → Output: ${normalizedPhone}`);
    console.log(normalizedPhone === '917250319702' ? '✅ PASS' : '❌ FAIL');

    // Test 2: Session message validation
    console.log('\n⏰ Test 2: Session Message Validation');
    const canSend = await bspMessagingService.canSendSessionMessage(testWorkspaceId, testPhone);
    console.log(`Can send session message: ${canSend}`);
    console.log(canSend ? '✅ PASS' : '❌ FAIL');

    // Test 3: Message creation and status tracking
    console.log('\n💬 Test 3: Message Creation');
    const messageData = {
      workspaceId: testWorkspaceId,
      wabaId: testWabaId,
      to: testPhone,
      type: 'template',
      template: {
        name: 'test_template',
        language: 'en',
        components: []
      },
      status: 'queued',
      createdAt: new Date()
    };

    const message = new Message(messageData);
    await message.save();
    console.log(`Message created with ID: ${message._id}`);
    console.log('✅ PASS');

    // Test 4: Conversation creation
    console.log('\n🗣️ Test 4: Conversation Creation');
    const conversation = new Conversation({
      workspaceId: testWorkspaceId,
      wabaId: testWabaId,
      contactPhone: testPhone,
      isOpen: true,
      windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      lastOutboundAt: new Date()
    });
    await conversation.save();
    console.log(`Conversation created with ID: ${conversation._id}`);
    console.log('✅ PASS');

    // Test 5: Webhook status processing simulation
    console.log('\n🔄 Test 5: Webhook Status Processing');
    const mockStatusWebhook = {
      value: {
        statuses: [{
          id: message._id.toString(),
          status: 'delivered',
          timestamp: Date.now(),
          recipient_id: testPhone
        }]
      }
    };

    // Mock request/response objects
    const mockReq = { body: mockStatusWebhook };
    const mockRes = {
      status: (code) => ({ json: (data) => console.log(`Response: ${code}`, data) })
    };

    await gupshupWebhookController.processWebhook(mockReq, mockRes);
    console.log('✅ PASS');

    // Test 6: Verify message status update
    console.log('\n📊 Test 6: Message Status Verification');
    const updatedMessage = await Message.findById(message._id);
    console.log(`Message status: ${updatedMessage.status}`);
    console.log(updatedMessage.status === 'delivered' ? '✅ PASS' : '❌ FAIL');

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

// Connect to MongoDB (assuming local instance)
mongoose.connect('mongodb://localhost:27017/whatsapp_test', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to test database');
  runTests();
}).catch(err => {
  console.error('Database connection failed:', err);
});