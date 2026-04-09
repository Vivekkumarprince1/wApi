const mongoose = require('mongoose');

const DealSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  pipeline: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', required: true },
  
  // Deal details
  title: { type: String, required: true }, // Deal name/title
  description: { type: String },
  value: { type: Number, default: 0 }, // Deal value in currency
  currency: { type: String, default: 'USD' },
  
  // Stage tracking
  stage: { type: String, required: true }, // Current stage ID (e.g., 'leads', 'qualified')
  
  // Owner assignment
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Agent responsible
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'won', 'lost', 'archived'],
    default: 'active'
  },
  
  // Advanced CRM Enrichment
  probability: { type: Number, min: 0, max: 100, default: 10 }, // Probability percentage
  expectedCloseDate: { type: Date },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  winLossReason: { type: String },
  
  // Lead Attribution
  source: { 
    type: String, 
    enum: ['manual', 'campaign', 'automation', 'answerbot', 'workflow', 'legacy'],
    default: 'manual' 
  },
  sourceId: { type: mongoose.Schema.Types.ObjectId }, // Reference to campaign/bot/workflow
  
  // Activity tracking
  notes: [
    {
      text: String,
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  
  // Stage history - immutable log
  stageHistory: [
    {
      stage: String,
      timestamp: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  
  // Granular Activity log for timeline
  activityLog: [
    {
      type: { 
        type: String, 
        enum: ['stage_change', 'note_added', 'assigned', 'status_change', 'attribute_update', 'created'] 
      },
      text: String,
      payload: mongoose.Schema.Types.Mixed,
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  
  // Custom fields (for extensibility)
  attributes: { 
    type: Object, 
    default: {}
  },
  
  // Timeline
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  closedAt: { type: Date } // When deal was won/lost
});

// Indexes for fast queries
DealSchema.index({ workspace: 1, contact: 1, status: 1 }, { 
  unique: true, 
  partialFilterExpression: { status: 'active' } 
}); // Only one active deal per contact per workspace
DealSchema.index({ workspace: 1, stage: 1 });
DealSchema.index({ workspace: 1, assignedAgent: 1 });
DealSchema.index({ workspace: 1, status: 1 });
DealSchema.index({ workspace: 1, createdAt: -1 });
DealSchema.index({ pipeline: 1, stage: 1 });

// Auto-update updatedAt
DealSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Deal', DealSchema);
