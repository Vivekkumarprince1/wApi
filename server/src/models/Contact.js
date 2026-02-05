const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String },
  phone: { type: String, required: true },
  tags: [String],
  metadata: { 
    type: Object, 
    default: {},
    firstName: String,
    lastName: String,
    email: String
  },
  
  // Sales CRM - Read-only reference to current active deal
  // (actual deal data lives in Deal model)
  activeDealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  activePipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline' },
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Activity timestamps for inbox
  lastInboundAt: { type: Date },
  lastOutboundAt: { type: Date },
  
  // Opt-out / Compliance
  optOut: {
    status: { type: Boolean, default: false },
    optedOutAt: { type: Date },
    optedOutVia: { type: String, enum: ['keyword', 'manual', 'webhook'], default: null },
    optedBackInAt: { type: Date }
  },

  // Opt-in tracking (explicit compliance trail)
  optIn: {
    status: { type: Boolean, default: false },
    optedInAt: { type: Date },
    optedInVia: { type: String, enum: ['inbound_message', 'import', 'api', 'manual'], default: null }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ContactSchema.index({ workspace: 1, phone: 1 }, { unique: true });
ContactSchema.index({ workspace: 1, 'metadata.email': 1 });
ContactSchema.index({ workspace: 1, createdAt: -1 });

// Update the updatedAt timestamp on save
ContactSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Remove contacts by identifiers for privacy deletion
 */
ContactSchema.statics.deleteByIdentifiers = async function({ workspaceId, phone, email }) {
  const query = {};
  if (workspaceId) query.workspace = workspaceId;
  if (phone) query.phone = phone;
  if (email) query['metadata.email'] = email;

  if (Object.keys(query).length === 0) return { deletedCount: 0 };

  const res = await this.deleteMany(query);
  return { deletedCount: res.deletedCount || 0 };
};

module.exports = mongoose.model('Contact', ContactSchema);
