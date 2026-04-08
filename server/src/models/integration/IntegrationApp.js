const mongoose = require('mongoose');

const IntegrationAppSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., 'Shopify', 'Razorpay'
  slug: { type: String, required: true, unique: true }, // 'shopify', 'razorpay'
  category: { type: String, enum: ['E-commerce', 'CRM', 'Payments', 'Business Tools', 'Aggregators', 'Ads'] },
  authType: { type: String, enum: ['OAUTH2', 'API_KEY', 'WEBHOOK'] },
  logoUrl: String,
  description: String,
  features: [String],
  supportedEvents: [{ // Events this app can trigger (e.g. 'Order Placed')
    eventName: String,
    eventSlug: String,
    schemaVariables: [String] // e.g. ['order_id', 'total_amount', 'customer_phone']
  }],
  supportedActions: [{ // Actions we can do in the app
    actionName: String,
    actionSlug: String
  }],
  status: { type: String, enum: ['ACTIVE', 'BETA', 'COMING_SOON'], default: 'ACTIVE' },
  planRequired: { type: String, enum: ['FREE', 'STARTER', 'GROWTH', 'ADVANCED'], default: 'FREE' }
}, { timestamps: true });

module.exports = mongoose.model('IntegrationApp', IntegrationAppSchema);
