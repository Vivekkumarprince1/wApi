const mongoose = require('mongoose');

const WorkspaceIntegrationSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  appId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationApp', required: true },
  status: { type: String, enum: ['CONNECTED', 'DISCONNECTED', 'ERROR'], default: 'CONNECTED' },
  credentials: {
    accessToken: String,
    refreshToken: String,
    apiKey: String,
    webhookSecret: String,
    expiresAt: Date,
    storeUrl: String // For apps like Shopify/WooCommerce
  },
  metadata: mongoose.Schema.Types.Mixed, // Any extra config
  activeWorkflows: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AutomationWorkflow' }] // if automation exists
}, { timestamps: true });

module.exports = mongoose.model('WorkspaceIntegration', WorkspaceIntegrationSchema);
