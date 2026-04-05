const mongoose = require('mongoose');

const ContactEventSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  type: { type: String, required: true }, // e.g., 'created', 'deal_won', 'msg_sent', 'tag_added', 'custom'
  description: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

ContactEventSchema.index({ workspace: 1, contact: 1, createdAt: -1 });

module.exports = mongoose.model('ContactEvent', ContactEventSchema);
