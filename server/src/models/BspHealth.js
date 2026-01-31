const mongoose = require('mongoose');

/**
 * BSP Health Snapshot
 * Stores system token health for internal visibility (no tokens stored).
 */
const BspHealthSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'system_token'
  status: { type: String, enum: ['healthy', 'warning', 'critical'], default: 'warning' },
  isValid: { type: Boolean, default: false },
  expiresAt: { type: Date },
  checkedAt: { type: Date },
  lastHealthyAt: { type: Date },
  error: { type: String },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('BspHealth', BspHealthSchema);
