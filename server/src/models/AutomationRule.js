const mongoose = require('mongoose');

const AutomationRuleSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  trigger: { type: String, enum: ['message_received', 'status_updated', 'campaign_completed'], required: true },
  condition: { type: Object, default: {} },
  actions: { type: Array, default: [] },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AutomationRule', AutomationRuleSchema);
