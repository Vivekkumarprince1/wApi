const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Plan } = require('../src/models');

const plans = [
  {
    name: 'Starter',
    slug: 'starter',
    currency: 'INR',
    monthlyBaseFeeCents: 49900,
    features: ['CRM', 'ANALYTICS', 'CONTACTS', 'CAMPAIGNS', 'MESSAGING', 'WHATSAPP_FORMS'],
    limits: {
      maxContacts: 1000,
      maxMessagesPerMonth: 10000,
      maxAutomations: 2,
      maxTemplates: 20,
      aiResolutionLimit: 0
    },
    razorpayPlanId: 'plan_starter_placeholder',
    isActive: true
  },
  {
    name: 'Growth',
    slug: 'growth',
    currency: 'INR',
    monthlyBaseFeeCents: 149900,
    features: ['CRM', 'ANSWERBOT', 'ANALYTICS', 'AUTOMATION', 'BULK_CAMPAIGN', 'WHATSAPP_FORMS', 'CONTACTS', 'CAMPAIGNS', 'MESSAGING'],
    limits: {
      maxContacts: 5000,
      maxMessagesPerMonth: 50000,
      maxAutomations: 10,
      maxTemplates: 100,
      aiResolutionLimit: 500
    },
    razorpayPlanId: 'plan_growth_placeholder',
    isActive: true
  },
  {
    name: 'Advanced',
    slug: 'advanced',
    currency: 'INR',
    monthlyBaseFeeCents: 499900,
    features: ['CRM', 'ANSWERBOT', 'ANALYTICS', 'AUTOMATION', 'BULK_CAMPAIGN', 'WHATSAPP_FORMS', 'CONTACTS', 'CAMPAIGNS', 'MESSAGING', 'COMMERCE'],
    limits: {
      maxContacts: 20000,
      maxMessagesPerMonth: 200000,
      maxAutomations: 50,
      maxTemplates: 500,
      aiResolutionLimit: 2000
    },
    razorpayPlanId: 'plan_advanced_placeholder',
    isActive: true
  }
];

async function seedPlans() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wapi';
    console.log(`Connecting to ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    for (const planData of plans) {
      await Plan.findOneAndUpdate(
        { slug: planData.slug },
        planData,
        { upsert: true, new: true }
      );
      console.log(`Successfully seeded/updated plan: ${planData.name}`);
    }

    console.log('Plan seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding plans:', error);
    process.exit(1);
  }
}

seedPlans();
