const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String },
  phone: { type: String, required: true },
  tags: [String],
  
  // Custom Fields (Unlimited key-value pairs)
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  
  // Lead status mapping for CRM Pipeline
  leadStatus: { 
    type: String, 
    default: 'new' // Typically: new, open, qualified, unqualified
  },

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
  
  /**
   * Cold contact detection:
   * true if the contact hasn't messaged the business yet.
   * false if we have received at least one inbound message.
   */
  isColdContact: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Virtual for display name
ContactSchema.virtual('displayName').get(function() {
  if (this.name && this.name !== 'Unknown') return this.name;
  if (this.metadata?.whatsappName && this.metadata.whatsappName !== 'Unknown') return this.metadata.whatsappName;
  return this.phone;
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
