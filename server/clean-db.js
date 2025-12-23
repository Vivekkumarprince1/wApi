const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { mongoUri } = require('./src/config');

async function connectDB() {
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB:', mongoUri);
}

async function cleanDatabase() {
  const Workspace = require('./src/models/Workspace');
  const User = require('./src/models/User');
  const Contact = require('./src/models/Contact');
  const Template = require('./src/models/Template');
  const Campaign = require('./src/models/Campaign');
  const Conversation = require('./src/models/Conversation');
  const Message = require('./src/models/Message');
  const AutomationRule = require('./src/models/AutomationRule');
  const WebhookLog = require('./src/models/WebhookLog');

  console.log('🗑️  Cleaning database...');
  await Promise.all([
    Workspace.deleteMany({}),
    User.deleteMany({}),
    Contact.deleteMany({}),
    Template.deleteMany({}),
    Campaign.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    AutomationRule.deleteMany({}),
    WebhookLog.deleteMany({})
  ]);
  console.log('✅ Database cleaned');
}

async function run() {
  try {
    await connectDB();
    await cleanDatabase();
    console.log('🎉 Done! Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Clean error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();