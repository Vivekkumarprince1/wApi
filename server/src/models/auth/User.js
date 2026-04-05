const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  googleId: { type: String },
  facebookId: { type: String },
  phone: { type: String },
  company: { type: String },
  emailVerified: { type: Boolean, default: false },
  role: { type: String, enum: ['owner', 'admin', 'manager', 'agent', 'member', 'viewer'], default: 'member' },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  status: { type: String, enum: ['active', 'invited', 'offline', 'removed'], default: 'active' },
  invitedAt: { type: Date },
  removedAt: { type: Date },
  joinedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Note: email index is already created by unique: true
UserSchema.index({ workspace: 1 });

// Update the updatedAt timestamp on save
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', UserSchema);
