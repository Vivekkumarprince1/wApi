const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  title: { type: String, required: true },
  description: { type: String },
  dueDate: { type: Date },
  priority: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedDeal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  relatedContact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  
  // Audit metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

// Auto-update updatedAt
TaskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set completedAt if status changes to Completed
  if (this.isModified('status') && this.status === 'Completed') {
    this.completedAt = new Date();
  }
  
  next();
});

// Indexes for performance
TaskSchema.index({ workspace: 1, assignee: 1 });
TaskSchema.index({ workspace: 1, status: 1 });
TaskSchema.index({ workspace: 1, dueDate: 1 });
TaskSchema.index({ relatedDeal: 1 });
TaskSchema.index({ relatedContact: 1 });

module.exports = mongoose.model('Task', TaskSchema);
