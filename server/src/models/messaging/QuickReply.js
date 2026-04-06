const mongoose = require('mongoose');

const QuickReplySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  shortcut: { type: String }, // e.g. "/hi"
  content: { type: String, required: true },
  mediaUrl: { type: String },
  mediaType: { type: String }, // image, video, document
  variables: [{
    name: { type: String }, // e.g. "name"
    fallback: { type: String }
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for workspace-based lookup
QuickReplySchema.index({ workspace: 1, name: 1 }, { unique: true });
QuickReplySchema.index({ workspace: 1, shortcut: 1 });

QuickReplySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('QuickReply', QuickReplySchema);
