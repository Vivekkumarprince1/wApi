const mongoose = require('mongoose');

const ContactSettingsSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true },
  
  // Custom Field Definitions (Limits up to 30 keys to display in UI etc)
  customFieldDefinitions: [
    {
      key: { type: String, required: true }, // e.g., 'company_size'
      label: { type: String, required: true }, // e.g., 'Company Size'
      type: { type: String, enum: ['string', 'number', 'boolean', 'date'], default: 'string' }
    }
  ],

  // Defined tags (Admin can restrict what tags exist)
  tagsOptions: [
    {
      label: { type: String },
      color: { type: String } // Hex color for UI
    }
  ],

  // Extendable lead statuses
  leadStatuses: [
    {
      key: { type: String, required: true },
      label: { type: String, required: true },
      color: { type: String }
    }
  ],

  // Auto-assignment rules
  autoAssign: {
    enabled: { type: Boolean, default: false },
    method: { type: String, enum: ['round_robin', 'load_equalizer', 'rules'], default: 'load_equalizer' },
    rules: [
      {
        field: { type: String }, // e.g., 'customFields.company_size'
        operator: { type: String, enum: ['equals', 'contains', 'gt', 'lt'] },
        value: { type: mongoose.Schema.Types.Mixed },
        assignTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
    // For Round Robin or Load Equalizer fallback
    fallbackAgents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },

  updatedAt: { type: Date, default: Date.now }
});

ContactSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Pre-seed some default statuses if empty
  if (!this.leadStatuses || this.leadStatuses.length === 0) {
    this.leadStatuses = [
      { key: 'new', label: 'New', color: '#10B981' },
      { key: 'open', label: 'Open', color: '#3B82F6' },
      { key: 'qualified', label: 'Qualified', color: '#F59E0B' },
      { key: 'unqualified', label: 'Unqualified', color: '#EF4444' }
    ];
  }
  
  next();
});

module.exports = mongoose.model('ContactSettings', ContactSettingsSchema);