const { Plan } = require('../../models');

/**
 * Bootstrap the database with essential records if they don't exist.
 */
async function bootstrap() {
  try {
    console.log('[Bootstrap] Checking system records...');
    await seedDefaultPlans();
    console.log('[Bootstrap] ✅ System records synchronized');
  } catch (err) {
    console.error('[Bootstrap] ❌ Synchronization failed:', err.message);
  }
}

/**
 * Ensures basic plan tiers exist for feature gating.
 */
async function seedDefaultPlans() {
  const plans = [
    {
      name: 'Free',
      slug: 'free',
      features: ['CRM', 'ANALYTICS', 'WHATSAPP_FORMS', 'COMMERCE'],
      limits: {
        maxContacts: 1000,
        maxMessagesPerMonth: 1000,
        maxAutomations: 5,
        maxTemplates: 10
      }
    },
    {
      name: 'Premium',
      slug: 'premium',
      features: ['CRM', 'ANSWERBOT', 'ANALYTICS', 'AUTOMATION', 'BULK_CAMPAIGN', 'WHATSAPP_FORMS', 'COMMERCE'],
      limits: {
        maxContacts: 1000000,
        maxMessagesPerMonth: 1000000,
        maxAutomations: 1000,
        maxTemplates: 1000,
        aiResolutionLimit: 5000
      }
    }
  ];

  for (const planData of plans) {
    const existing = await Plan.findOne({ slug: planData.slug });
    if (!existing) {
      console.log(`[Bootstrap] Seeding '${planData.name}' plan...`);
      await Plan.create(planData);
    }
  }
}

module.exports = { bootstrap };
