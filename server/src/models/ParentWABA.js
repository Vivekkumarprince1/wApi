const mongoose = require('mongoose');

/**
 * ParentWABA Model
 *
 * Interakt-style single Parent WABA authority.
 * Stores platform-owned Meta assets and tokens (no tenant ownership).
 */
const ParentWABASchema = new mongoose.Schema({
  name: { type: String, default: 'Primary Parent WABA' },
  wabaId: { type: String, required: true, unique: true },
  businessId: { type: String },
  appId: { type: String },
  configId: { type: String },
  systemUserId: { type: String },
  systemUserTokenRef: { type: String },
  systemUserTokenExpiry: { type: Date },
  webhookVerifyToken: { type: String },
  apiVersion: { type: String, default: 'v21.0' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ParentWABASchema.index({ active: 1, wabaId: 1 });

ParentWABASchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ParentWABA', ParentWABASchema);
