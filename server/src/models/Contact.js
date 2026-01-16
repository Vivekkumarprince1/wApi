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

module.exports = mongoose.model('Contact', ContactSchema);
