const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { mongoUri } = require('../src/config');

// Parse command line arguments
const args = process.argv.slice(2);
const CLEAN_MODE = args.includes('--clean');
const DEMO_MODE = args.includes('--demo');

async function connectDB() {
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB:', mongoUri);
}

// Utility: upsert helper
async function upsert(model, filter, data) {
  const existing = await model.findOne(filter);
  if (existing) {
    await model.updateOne({ _id: existing._id }, { $set: data });
    return await model.findById(existing._id);
  }
  return await model.create({ ...filter, ...data });
}

// Extract template variables from text
function extractVariables(text = '') {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1]);
  return [...new Set(matches)].sort();
}

// Generate random phone number
function randomPhone(countryCode = '91') {
  const num = Math.floor(1000000000 + Math.random() * 9000000000);
  return `${countryCode}${num}`;
}

// Generate random date within range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function cleanDatabase() {
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  const Contact = require('../src/models/Contact');
  const Template = require('../src/models/Template');
  const Campaign = require('../src/models/Campaign');
  const Conversation = require('../src/models/Conversation');
  const Message = require('../src/models/Message');
  const AutomationRule = require('../src/models/AutomationRule');
  const WebhookLog = require('../src/models/WebhookLog');

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

async function seed() {
  // Load models
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  const Contact = require('../src/models/Contact');
  const Template = require('../src/models/Template');
  const Campaign = require('../src/models/Campaign');
  const Conversation = require('../src/models/Conversation');
  const Message = require('../src/models/Message');
  const AutomationRule = require('../src/models/AutomationRule');
  const WebhookLog = require('../src/models/WebhookLog');

  console.log('\n📦 Starting seed process...\n');

  // ============================================
  // 1. CREATE WORKSPACES
  // ============================================
  console.log('🏢 Creating workspaces...');

  // Main demo workspace (verified, connected)
  const mainWorkspace = await upsert(Workspace, { name: 'Acme Corporation' }, {
    plan: 'premium',
    industry: 'E-commerce',
    companySize: '51-200 employees',
    website: 'https://acme-corp.example.com',
    address: '123 Business Park, Sector 5',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    zipCode: '560001',
    description: 'Leading e-commerce platform for consumer electronics',
    
    // Business Documents
    businessDocuments: {
      gstNumber: '29AABCU9603R1ZM',
      panNumber: 'AABCU9603R',
      documentType: 'gst',
      submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    },
    
    // Verified status
    businessVerification: {
      status: 'verified',
      submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      verifiedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      metaVerificationId: 'MV_12345678'
    },
    
    // Onboarding completed
    onboarding: {
      businessInfoCompleted: true,
      businessInfoCompletedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      wabaConnectionInitiated: true,
      wabaConnectionInitiatedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
      wabaConnectionCompleted: true,
      wabaConnectionCompletedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      completed: true,
      completedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
    },
    
    // WhatsApp Connected
    whatsappSetup: {
      requestedNumber: '919876543210',
      hasExistingAccount: false,
      requestedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
      status: 'connected',
      verifiedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
      registrationCompletedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
    },
    
    // WABA credentials (dummy for testing)
    whatsappAccessToken: 'EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    whatsappPhoneNumberId: '1234567890123456',
    whatsappPhoneNumber: '919876543210',
    wabaId: 'WABA_123456789',
    businessAccountId: 'BA_987654321',
    whatsappVerifyToken: 'verify_token_acme_123',
    connectedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    
    // Plan limits (premium)
    planLimits: {
      maxContacts: 10000,
      maxMessages: 50000,
      maxTemplates: 100,
      maxCampaigns: 50,
      maxAutomations: 25
    },
    
    // Usage
    usage: {
      contacts: 156,
      messages: 2450,
      templates: 8,
      campaigns: 5,
      automations: 3
    },
    
    // WhatsApp Config
    whatsappConfig: {
      phoneNumberId: '1234567890123456',
      businessAccountId: 'BA_987654321',
      accessToken: 'EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      webhookVerifyToken: 'verify_token_acme_123',
      isConnected: true
    },
    
    // Subscription
    subscription: {
      status: 'active',
      startDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
      autoRenew: true
    }
  });

  // Second workspace (pending verification)
  const pendingWorkspace = await upsert(Workspace, { name: 'StartupXYZ' }, {
    plan: 'basic',
    industry: 'Technology',
    companySize: '11-50 employees',
    website: 'https://startupxyz.io',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    
    businessDocuments: {
      msmeNumber: 'UDYAM-MH-19-0012345',
      documentType: 'msme',
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    },
    
    businessVerification: {
      status: 'pending',
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    },
    
    onboarding: {
      businessInfoCompleted: true,
      businessInfoCompletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      wabaConnectionInitiated: true,
      wabaConnectionInitiatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      wabaConnectionCompleted: false,
      completed: false
    },
    
    whatsappSetup: {
      requestedNumber: '919123456789',
      status: 'pending_activation',
      requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      verifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    
    planLimits: {
      maxContacts: 1000,
      maxMessages: 5000,
      maxTemplates: 25,
      maxCampaigns: 10,
      maxAutomations: 5
    },
    
    usage: {
      contacts: 45,
      messages: 120,
      templates: 3,
      campaigns: 1,
      automations: 1
    },
    
    subscription: {
      status: 'active',
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)
    }
  });

  // Free tier workspace
  const freeWorkspace = await upsert(Workspace, { name: 'FreeTrial User' }, {
    plan: 'free',
    industry: 'Retail',
    companySize: '1-10 employees',
    
    businessVerification: {
      status: 'not_submitted'
    },
    
    onboarding: {
      businessInfoCompleted: false,
      completed: false
    },
    
    planLimits: {
      maxContacts: 100,
      maxMessages: 1000,
      maxTemplates: 10,
      maxCampaigns: 5,
      maxAutomations: 3
    },
    
    subscription: {
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  console.log('   ✓ Created 3 workspaces');

  // ============================================
  // 2. CREATE USERS
  // ============================================
  console.log('👥 Creating users...');

  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const demoPasswordHash = await bcrypt.hash('demo123', 10);

  // Main workspace users
  const owner = await upsert(User, { email: 'owner@acme.example.com' }, {
    name: 'Rajesh Kumar',
    passwordHash: defaultPasswordHash,
    phone: '919876543210',
    company: 'Acme Corporation',
    emailVerified: true,
    role: 'owner',
    workspace: mainWorkspace._id
  });

  const admin = await upsert(User, { email: 'admin@acme.example.com' }, {
    name: 'Priya Sharma',
    passwordHash: defaultPasswordHash,
    phone: '919876543211',
    emailVerified: true,
    role: 'admin',
    workspace: mainWorkspace._id
  });

  const agent1 = await upsert(User, { email: 'agent1@acme.example.com' }, {
    name: 'Amit Patel',
    passwordHash: defaultPasswordHash,
    emailVerified: true,
    role: 'member',
    workspace: mainWorkspace._id
  });

  const agent2 = await upsert(User, { email: 'agent2@acme.example.com' }, {
    name: 'Sneha Reddy',
    passwordHash: defaultPasswordHash,
    emailVerified: true,
    role: 'member',
    workspace: mainWorkspace._id
  });

  // Pending workspace user
  const pendingOwner = await upsert(User, { email: 'owner@startupxyz.io' }, {
    name: 'Vikram Singh',
    passwordHash: defaultPasswordHash,
    emailVerified: true,
    role: 'owner',
    workspace: pendingWorkspace._id
  });

  // Free tier user
  const freeUser = await upsert(User, { email: 'user@freetrial.example.com' }, {
    name: 'Demo User',
    passwordHash: defaultPasswordHash,
    emailVerified: true,
    role: 'owner',
    workspace: freeWorkspace._id
  });

  // Demo user (if --demo flag is set)
  let demoUser = null;
  if (DEMO_MODE) {
    demoUser = await upsert(User, { email: 'demo@example.com' }, {
      name: 'Demo Account',
      passwordHash: demoPasswordHash,
      emailVerified: true,
      role: 'owner',
      workspace: mainWorkspace._id
    });
    console.log('   ✓ Demo user created: demo@example.com / demo123');
  }

  console.log(`   ✓ Created ${DEMO_MODE ? 7 : 6} users`);

  // ============================================
  // 3. CREATE CONTACTS
  // ============================================
  console.log('📇 Creating contacts...');

  const contactNames = [
    { name: 'Rahul Verma', tags: ['customer', 'premium'] },
    { name: 'Ananya Iyer', tags: ['customer', 'newsletter'] },
    { name: 'Karthik Nair', tags: ['lead', 'website'] },
    { name: 'Meera Gupta', tags: ['customer', 'vip'] },
    { name: 'Arjun Reddy', tags: ['lead', 'social'] },
    { name: 'Deepika Menon', tags: ['customer', 'newsletter', 'premium'] },
    { name: 'Sanjay Pillai', tags: ['lead'] },
    { name: 'Kavitha Rajan', tags: ['customer', 'support'] },
    { name: 'Vishal Krishnan', tags: ['lead', 'campaign'] },
    { name: 'Lakshmi Subramanian', tags: ['customer'] },
    { name: 'Aditya Bose', tags: ['customer', 'premium', 'vip'] },
    { name: 'Ritu Joshi', tags: ['lead', 'webinar'] },
    { name: 'Naveen Kumar', tags: ['customer', 'newsletter'] },
    { name: 'Swathi Menon', tags: ['lead', 'referral'] },
    { name: 'Gaurav Chatterjee', tags: ['customer', 'support'] },
    { name: 'Pooja Desai', tags: ['lead', 'trial'] },
    { name: 'Rohit Saxena', tags: ['customer', 'premium'] },
    { name: 'Neha Kulkarni', tags: ['customer'] },
    { name: 'Suresh Yadav', tags: ['lead', 'cold'] },
    { name: 'Anjali Mishra', tags: ['customer', 'newsletter', 'active'] }
  ];

  const contacts = [];
  for (let i = 0; i < contactNames.length; i++) {
    const { name, tags } = contactNames[i];
    const phone = randomPhone();
    const contact = await upsert(Contact, { workspace: mainWorkspace._id, phone }, {
      name,
      tags,
      metadata: {
        firstName: name.split(' ')[0],
        lastName: name.split(' ')[1] || '',
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        source: tags.includes('lead') ? 'website' : 'import',
        lastPurchase: tags.includes('customer') ? randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()) : null
      }
    });
    contacts.push(contact);
  }

  // Add a few contacts to pending workspace
  for (let i = 0; i < 5; i++) {
    const phone = randomPhone();
    await upsert(Contact, { workspace: pendingWorkspace._id, phone }, {
      name: `Contact ${i + 1}`,
      tags: ['imported']
    });
  }

  console.log(`   ✓ Created ${contacts.length + 5} contacts`);

  // ============================================
  // 4. CREATE TEMPLATES
  // ============================================
  console.log('📄 Creating templates...');

  const templateSpecs = [
    {
      name: 'welcome_message',
      language: 'en',
      category: 'UTILITY',
      body: 'Welcome {{1}} to Acme Corporation! 🎉\n\nWe are excited to have you on board. Your account has been created successfully.\n\nIf you have any questions, feel free to reply to this message.',
      status: 'APPROVED',
      headerText: 'Welcome to Acme!',
      preview: 'Welcome new customers to your platform'
    },
    {
      name: 'order_confirmation',
      language: 'en',
      category: 'UTILITY',
      body: 'Hi {{1}},\n\nYour order #{{2}} has been confirmed! 📦\n\nTotal: ₹{{3}}\nEstimated delivery: {{4}}\n\nTrack your order: {{5}}',
      status: 'APPROVED',
      headerText: 'Order Confirmed!',
      preview: 'Send order confirmation with tracking'
    },
    {
      name: 'shipping_update',
      language: 'en',
      category: 'UTILITY',
      body: 'Hi {{1}},\n\nGreat news! Your order #{{2}} has been shipped. 🚚\n\nTracking ID: {{3}}\nExpected delivery: {{4}}\n\nTrack here: {{5}}',
      status: 'APPROVED',
      preview: 'Notify customers about shipping'
    },
    {
      name: 'payment_reminder',
      language: 'en',
      category: 'UTILITY',
      body: 'Hi {{1}},\n\nThis is a friendly reminder that your payment of ₹{{2}} is due on {{3}}.\n\nPay now to avoid late fees: {{4}}',
      status: 'APPROVED',
      preview: 'Remind customers about pending payments'
    },
    {
      name: 'otp_verification',
      language: 'en',
      category: 'AUTHENTICATION',
      body: 'Your OTP is: {{1}}\n\nThis code is valid for 10 minutes. Do not share this code with anyone.',
      status: 'APPROVED',
      preview: 'Send OTP for verification'
    },
    {
      name: 'promotional_offer',
      language: 'en',
      category: 'MARKETING',
      body: 'Hi {{1}}! 🎁\n\nExclusive offer just for you!\n\nGet {{2}}% OFF on your next purchase.\nUse code: {{3}}\n\nValid till {{4}}. Shop now!',
      status: 'APPROVED',
      preview: 'Promotional discount offer'
    },
    {
      name: 'flash_sale',
      language: 'en',
      category: 'MARKETING',
      body: '⚡ FLASH SALE ALERT! ⚡\n\nHi {{1}},\n\nOnly for the next {{2}} hours!\nUp to {{3}}% OFF on select items.\n\nDon\'t miss out - shop now!',
      status: 'APPROVED',
      preview: 'Flash sale announcement'
    },
    {
      name: 'feedback_request',
      language: 'en',
      category: 'MARKETING',
      body: 'Hi {{1}},\n\nWe hope you loved your recent purchase!\n\nWould you mind taking a moment to share your feedback? It helps us serve you better.\n\nRate us: {{2}}',
      status: 'PENDING',
      preview: 'Request customer feedback'
    },
    {
      name: 'newsletter_signup',
      language: 'en',
      category: 'MARKETING',
      body: 'Thanks for subscribing, {{1}}! 📰\n\nYou\'ll now receive our weekly newsletter with:\n- Latest offers\n- New arrivals\n- Exclusive content\n\nStay tuned!',
      status: 'PENDING',
      preview: 'Newsletter subscription confirmation'
    },
    {
      name: 'urgent_sale',
      language: 'en',
      category: 'MARKETING',
      body: '🚨 URGENT! Buy NOW or regret later! Limited stock - ACT FAST! 🚨',
      status: 'REJECTED',
      rejectionReason: 'Template contains misleading urgency language that may create false sense of urgency.',
      preview: 'Rejected template example'
    },
    {
      name: 'welcome_hindi',
      language: 'hi',
      category: 'UTILITY',
      body: 'नमस्ते {{1}}! 🙏\n\nAcme Corporation में आपका स्वागत है!\n\nआपका अकाउंट सफलतापूर्वक बना दिया गया है।\n\nकिसी भी सहायता के लिए इस नंबर पर संपर्क करें।',
      status: 'APPROVED',
      headerText: 'स्वागत है!',
      preview: 'Hindi welcome message'
    }
  ];

  const templates = [];
  for (const spec of templateSpecs) {
    const variables = extractVariables(spec.body).map(v => `{{${v}}}`);
    const bodyText = spec.body;
    
    const template = await upsert(Template, { workspace: mainWorkspace._id, name: spec.name }, {
      language: spec.language,
      category: spec.category,
      components: [
        spec.headerText ? { type: 'HEADER', format: 'TEXT', text: spec.headerText } : null,
        { type: 'BODY', text: bodyText }
      ].filter(Boolean),
      status: spec.status,
      rejectionReason: spec.rejectionReason,
      createdBy: owner._id,
      variables,
      bodyText,
      headerText: spec.headerText,
      preview: spec.preview,
      source: 'LOCAL',
      submittedAt: spec.status !== 'DRAFT' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : undefined,
      approvedAt: spec.status === 'APPROVED' ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : undefined,
      qualityScore: spec.status === 'APPROVED' ? 'GREEN' : 'UNKNOWN'
    });
    templates.push(template);
  }

  mainWorkspace.usage.templates = templates.length;
  await mainWorkspace.save();

  console.log(`   ✓ Created ${templates.length} templates`);

  // ============================================
  // 5. CREATE CAMPAIGNS
  // ============================================
  console.log('📣 Creating campaigns...');

  const welcomeTemplate = templates.find(t => t.name === 'welcome_message');
  const promoTemplate = templates.find(t => t.name === 'promotional_offer');

  await upsert(Campaign, { workspace: mainWorkspace._id, name: 'Welcome Campaign - Nov 2025' }, {
    message: 'Welcome to Acme! Thanks for joining us.',
    template: welcomeTemplate?._id,
    messageTemplate: 'welcome_message',
    contacts: contacts.slice(0, 10).map(c => c._id),
    status: 'completed',
    totalContacts: 10,
    sentCount: 10,
    deliveredCount: 9,
    readCount: 7,
    repliedCount: 2,
    failedCount: 0,
    startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    createdBy: owner._id
  });

  await upsert(Campaign, { workspace: mainWorkspace._id, name: 'Black Friday Sale 2025' }, {
    message: 'Get up to 50% OFF this Black Friday!',
    template: promoTemplate?._id,
    messageTemplate: 'promotional_offer',
    contacts: contacts.slice(5, 15).map(c => c._id),
    status: 'running',
    totalContacts: 10,
    sentCount: 6,
    deliveredCount: 5,
    readCount: 3,
    repliedCount: 1,
    failedCount: 1,
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdBy: admin._id
  });

  await upsert(Campaign, { workspace: mainWorkspace._id, name: 'New Year Offer 2026' }, {
    message: 'Ring in 2026 with amazing offers!',
    contacts: contacts.slice(10, 20).map(c => c._id),
    status: 'scheduled',
    totalContacts: 10,
    scheduleAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    createdBy: owner._id
  });

  await upsert(Campaign, { workspace: mainWorkspace._id, name: 'Customer Feedback Drive' }, {
    message: 'We value your feedback! Please share your experience with us.',
    contacts: [],
    status: 'draft',
    totalContacts: 0,
    createdBy: agent1._id
  });

  await upsert(Campaign, { workspace: mainWorkspace._id, name: 'Test Campaign' }, {
    message: 'This was a test campaign.',
    contacts: contacts.slice(0, 3).map(c => c._id),
    status: 'failed',
    totalContacts: 3,
    sentCount: 0,
    failedCount: 3,
    startedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    createdBy: owner._id
  });

  console.log('   ✓ Created 5 campaigns');

  // ============================================
  // 6. CREATE CONVERSATIONS & MESSAGES
  // ============================================
  console.log('💬 Creating conversations and messages...');

  const conversationData = [
    {
      contact: contacts[0],
      status: 'open',
      assignedTo: agent1,
      tags: ['sales', 'high-priority'],
      messages: [
        { dir: 'outbound', type: 'template', body: 'Welcome Rahul to Acme Corporation! We are excited to have you on board.', status: 'delivered' },
        { dir: 'inbound', type: 'text', body: 'Thanks! I saw your products online. Can you tell me more about the warranty?', status: 'received' },
        { dir: 'outbound', type: 'text', body: 'Hi Rahul! All our products come with a 2-year warranty. Would you like more details on any specific product?', status: 'delivered' },
        { dir: 'inbound', type: 'text', body: 'Yes, I\'m interested in the Pro Max model. What\'s the price?', status: 'received' },
        { dir: 'outbound', type: 'text', body: 'The Pro Max is ₹45,999. We also have a special offer - get 10% off with code WELCOME10!', status: 'read' }
      ]
    },
    {
      contact: contacts[1],
      status: 'open',
      assignedTo: agent2,
      tags: ['support'],
      messages: [
        { dir: 'inbound', type: 'text', body: 'Hi, I placed an order 3 days ago but haven\'t received any update. Order #12345', status: 'received' },
        { dir: 'outbound', type: 'text', body: 'Hi Ananya! Let me check your order status. Please hold on for a moment.', status: 'delivered' },
        { dir: 'outbound', type: 'text', body: 'Your order #12345 is currently being processed and will be shipped tomorrow.', status: 'read' },
        { dir: 'inbound', type: 'text', body: 'Great, thank you!', status: 'received' }
      ]
    },
    {
      contact: contacts[2],
      status: 'pending',
      assignedTo: null,
      tags: ['lead'],
      messages: [
        { dir: 'inbound', type: 'text', body: 'Hi, I saw your ad on Instagram. Do you offer bulk pricing?', status: 'received' },
        { dir: 'outbound', type: 'text', body: 'Hello! Yes, we do offer bulk pricing for orders above 50 units.', status: 'sent' }
      ]
    },
    {
      contact: contacts[3],
      status: 'resolved',
      assignedTo: owner,
      tags: ['vip', 'resolved'],
      messages: [
        { dir: 'outbound', type: 'text', body: 'Hi Meera! As a VIP customer, you get early access to our Black Friday sale.', status: 'read' },
        { dir: 'inbound', type: 'text', body: 'Amazing! Just placed an order. You guys are the best! 😊', status: 'received' },
        { dir: 'outbound', type: 'text', body: 'Thank you for your continued support, Meera! Your order will be prioritized. 🙏', status: 'read' }
      ]
    },
    {
      contact: contacts[4],
      status: 'open',
      assignedTo: agent1,
      messages: [
        { dir: 'outbound', type: 'template', body: 'Hi Arjun! Get 20% OFF on your next purchase. Use code SAVE20.', status: 'delivered' },
        { dir: 'inbound', type: 'text', body: 'Is this applicable on all products?', status: 'received' }
      ]
    },
    {
      contact: contacts[10],
      status: 'open',
      assignedTo: owner,
      tags: ['vip', 'premium', 'high-value'],
      messages: [
        { dir: 'inbound', type: 'text', body: 'I need to place a large order for my company. Around 100 units.', status: 'received' },
        { dir: 'outbound', type: 'text', body: 'Hi Aditya! That\'s great to hear. For orders of 100+ units, we offer special corporate pricing.', status: 'read' },
        { dir: 'inbound', type: 'text', body: 'Yes, please. Also, do you offer customization?', status: 'received' },
        { dir: 'outbound', type: 'text', body: 'Absolutely! We offer logo printing and custom packaging for bulk orders.', status: 'delivered' }
      ]
    }
  ];

  let totalMessages = 0;
  for (const convData of conversationData) {
    const lastMsg = convData.messages[convData.messages.length - 1];
    
    await upsert(Conversation, { workspace: mainWorkspace._id, contact: convData.contact._id }, {
      channel: 'whatsapp',
      assignedTo: convData.assignedTo?._id,
      status: convData.status,
      unreadCount: convData.messages.filter(m => m.dir === 'inbound' && m.status === 'received').length,
      lastMessageAt: new Date(),
      lastMessagePreview: lastMsg.body.substring(0, 50) + (lastMsg.body.length > 50 ? '...' : ''),
      lastMessageDirection: lastMsg.dir,
      tags: convData.tags || [],
      lastActivityAt: new Date()
    });

    const existingCount = await Message.countDocuments({ workspace: mainWorkspace._id, contact: convData.contact._id });
    if (existingCount < convData.messages.length) {
      await Message.deleteMany({ workspace: mainWorkspace._id, contact: convData.contact._id });
      
      for (let i = 0; i < convData.messages.length; i++) {
        const msg = convData.messages[i];
        const msgTime = new Date(Date.now() - (convData.messages.length - i) * 30 * 60 * 1000);
        
        await Message.create({
          workspace: mainWorkspace._id,
          contact: convData.contact._id,
          direction: msg.dir,
          type: msg.type,
          body: msg.body,
          status: msg.status,
          sentAt: msg.dir === 'outbound' ? msgTime : undefined,
          deliveredAt: msg.status === 'delivered' || msg.status === 'read' ? new Date(msgTime.getTime() + 5000) : undefined,
          readAt: msg.status === 'read' ? new Date(msgTime.getTime() + 60000) : undefined,
          createdAt: msgTime
        });
        totalMessages++;
      }
    }
  }

  console.log(`   ✓ Created ${conversationData.length} conversations with ${totalMessages} messages`);

  // ============================================
  // 7. CREATE AUTOMATION RULES
  // ============================================
  console.log('🤖 Creating automation rules...');

  const autoRules = [
    {
      name: 'Welcome Auto-Reply',
      trigger: 'message_received',
      condition: { type: 'first_message', isFirstMessage: true },
      actions: [{ type: 'send_message', template: 'welcome_message', delay: 0 }],
      enabled: true
    },
    {
      name: 'After Hours Response',
      trigger: 'message_received',
      condition: { type: 'time_based', outsideBusinessHours: true, businessHours: { start: '09:00', end: '18:00', timezone: 'Asia/Kolkata' } },
      actions: [{ type: 'send_message', message: 'Thanks for reaching out! Our team is currently offline. We\'ll get back to you during business hours.', delay: 0 }],
      enabled: true
    },
    {
      name: 'Tag VIP Customers',
      trigger: 'message_received',
      condition: { type: 'keyword', keywords: ['corporate', 'bulk order', 'enterprise'] },
      actions: [{ type: 'add_tag', tag: 'potential-vip' }, { type: 'notify_team', message: 'Potential VIP customer detected!' }],
      enabled: true
    },
    {
      name: 'Support Ticket Auto-Assign',
      trigger: 'message_received',
      condition: { type: 'keyword', keywords: ['complaint', 'issue', 'problem', 'refund', 'broken'] },
      actions: [{ type: 'add_tag', tag: 'support-needed' }, { type: 'assign_agent', assignmentType: 'round-robin' }],
      enabled: false
    }
  ];

  for (const rule of autoRules) {
    await upsert(AutomationRule, { workspace: mainWorkspace._id, name: rule.name }, {
      trigger: rule.trigger,
      condition: rule.condition,
      actions: rule.actions,
      enabled: rule.enabled
    });
  }

  console.log(`   ✓ Created ${autoRules.length} automation rules`);

  // ============================================
  // 8. CREATE WEBHOOK LOGS
  // ============================================
  console.log('📝 Creating webhook logs...');

  const webhookLogs = [
    {
      eventType: 'message',
      payload: { object: 'whatsapp_business_account', entry: [{ id: 'WABA_123456789', changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '1234567890123456' }, messages: [{ id: 'msg_123', from: '919876543210', type: 'text', text: { body: 'Hello!' } }] }, field: 'messages' }] }] },
      verified: true,
      processed: true,
      processedAt: new Date(Date.now() - 60000)
    },
    {
      eventType: 'status',
      payload: { object: 'whatsapp_business_account', entry: [{ id: 'WABA_123456789', changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '1234567890123456' }, statuses: [{ id: 'msg_456', status: 'delivered', timestamp: Date.now() / 1000 }] }, field: 'messages' }] }] },
      verified: true,
      processed: true,
      processedAt: new Date(Date.now() - 30000)
    },
    {
      eventType: 'template_status',
      payload: { object: 'whatsapp_business_account', entry: [{ id: 'WABA_123456789', changes: [{ value: { event: 'APPROVED', message_template_name: 'promotional_offer', message_template_language: 'en' }, field: 'message_template_status_update' }] }] },
      verified: true,
      processed: true,
      processedAt: new Date(Date.now() - 3600000)
    }
  ];

  for (const log of webhookLogs) {
    await WebhookLog.create({ workspace: mainWorkspace._id, source: 'meta', ...log });
  }

  console.log(`   ✓ Created ${webhookLogs.length} webhook logs`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('✅ SEED COMPLETED SUCCESSFULLY');
  console.log('='.repeat(50));
  console.log(`
📊 Summary:
   • Workspaces: 3
   • Users: ${DEMO_MODE ? 7 : 6}
   • Contacts: ${contacts.length + 5}
   • Templates: ${templates.length}
   • Campaigns: 5
   • Conversations: ${conversationData.length}
   • Messages: ${totalMessages}
   • Automation Rules: ${autoRules.length}
   • Webhook Logs: ${webhookLogs.length}

🔑 Test Accounts:
   • owner@acme.example.com / password123 (Owner - Verified Workspace)
   • admin@acme.example.com / password123 (Admin)
   • agent1@acme.example.com / password123 (Agent)
   • owner@startupxyz.io / password123 (Owner - Pending Workspace)
   • user@freetrial.example.com / password123 (Free Tier)
   ${DEMO_MODE ? '• demo@example.com / demo123 (Demo Account)' : ''}
  `);
}

async function run() {
  try {
    await connectDB();
    
    if (CLEAN_MODE) {
      await cleanDatabase();
    }
    
    await seed();
    
    console.log('🎉 Done! Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();