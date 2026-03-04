const mongoose = require('mongoose');

const PipelineSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  description: { type: String },
  
  // Stage configuration for this pipeline
  stages: [
    {
      id: { type: String, required: true }, // e.g., 'leads', 'qualified', 'proposal', 'won', 'lost'
      title: { type: String, required: true }, // e.g., 'Leads', 'Qualified', etc.
      position: { type: Number, required: true }, // Order in pipeline
      isFinal: { type: Boolean, default: false }, // Is this a terminal stage? (won/lost)
      color: { type: String, default: '#6B7280' } // Hex color for UI
    }
  ],
  
  // Whether this is the default pipeline for the workspace
  isDefault: { type: Boolean, default: false },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure unique pipeline names per workspace
PipelineSchema.index({ workspace: 1, name: 1 }, { unique: true });
PipelineSchema.index({ workspace: 1, isDefault: 1 });

PipelineSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Pipeline', PipelineSchema);
