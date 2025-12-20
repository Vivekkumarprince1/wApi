const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  type: { type: String, enum: ['text', 'template', 'image', 'video', 'document', 'audio'], default: 'text' },
  body: { type: String },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'received'], default: 'queued' },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
