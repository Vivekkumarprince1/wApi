require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const IntegrationApp = require('../src/models/integration/IntegrationApp');

const apps = [
  {
    name: 'Shopify',
    slug: 'shopify',
    category: 'E-commerce',
    authType: 'OAUTH2',
    logoUrl: 'https://cdn.shopify.com/assets/images/logos/shopify-bag.png',
    description: 'Syncs orders, customers, products, abandoned carts. Auto order confirmation/shipping updates on WhatsApp, abandoned-cart recovery sequences.',
    features: ['Auto order notifications', 'Abandoned cart recovery', 'Catalog sync'],
    supportedEvents: [
      { eventName: 'Order Created', eventSlug: 'order_created', schemaVariables: ['order_id', 'total_amount', 'customer_phone', 'cart_url'] },
      { eventName: 'Abandoned Checkout', eventSlug: 'abandoned_checkout', schemaVariables: ['checkout_url', 'total_amount', 'customer_phone'] }
    ],
    status: 'ACTIVE',
    planRequired: 'STARTER'
  },
  {
    name: 'Razorpay',
    slug: 'razorpay',
    category: 'Payments',
    authType: 'API_KEY',
    logoUrl: 'https://razorpay.com/favicon.png',
    description: 'Generate/send payment links in one click; payment confirmations on WhatsApp.',
    features: ['Payment links via WhatsApp', 'Payment Confirmations'],
    supportedEvents: [
      { eventName: 'Payment Success', eventSlug: 'payment_success', schemaVariables: ['payment_id', 'amount', 'customer_phone'] },
      { eventName: 'Payment Failed', eventSlug: 'payment_failed', schemaVariables: ['payment_id', 'amount', 'customer_phone'] }
    ],
    status: 'ACTIVE',
    planRequired: 'FREE'
  },
  {
    name: 'Zapier',
    slug: 'zapier',
    category: 'Aggregators',
    authType: 'API_KEY',
    logoUrl: 'https://cdn.zapier.com/zapier/images/favicon.ico',
    description: 'Connect to 1000+ apps. Use WhatsApp triggers/actions for multi-step automations.',
    features: ['Custom workflows', 'Multi-app integrations'],
    supportedEvents: [
      { eventName: 'Custom Webhook Event', eventSlug: 'custom_event', schemaVariables: ['payload'] }
    ],
    status: 'ACTIVE',
    planRequired: 'FREE'
  },
  {
    name: 'WooCommerce',
    slug: 'woocommerce',
    category: 'E-commerce',
    authType: 'API_KEY',
    description: 'Real-time order notifications, catalog browsing in chat, abandoned-cart recovery.',
    features: ['Order confirmation', 'Cart recovery'],
    status: 'ACTIVE'
  },
  {
    name: 'HubSpot',
    slug: 'hubspot',
    category: 'CRM',
    authType: 'OAUTH2',
    description: 'Auto-sync contacts/communications; new HubSpot entry → WhatsApp notification.',
    status: 'ACTIVE',
    planRequired: 'GROWTH'
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB');
    await IntegrationApp.deleteMany({});
    console.log('Cleared existing integration apps');
    await IntegrationApp.insertMany(apps);
    console.log('Seeded integration apps');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
