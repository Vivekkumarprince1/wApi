import mongoose, { Schema, Document, Model } from 'mongoose';

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export enum TaskStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed'
}

export enum TaskType {
  CALL = 'Call',
  WHATSAPP = 'WhatsApp',
  MEETING = 'Meeting',
  EMAIL = 'Email',
  FOLLOW_UP = 'Follow-up'
}

export interface ITask extends Document {
  workspace: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  type: TaskType;
  dueDate?: Date;
  priority: TaskPriority;
  status: TaskStatus;
  assignee?: mongoose.Types.ObjectId;
  relatedDeal?: mongoose.Types.ObjectId;
  relatedContact?: mongoose.Types.ObjectId;
  reminders: Array<{
    timestamp: Date;
    sent: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const TaskSchema: Schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  title: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: Object.values(TaskType),
    default: TaskType.FOLLOW_UP
  },
  dueDate: { type: Date },
  priority: { 
    type: String, 
    enum: Object.values(TaskPriority),
    default: TaskPriority.MEDIUM
  },
  status: { 
    type: String, 
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING
  },
  assignee: { type: Schema.Types.ObjectId, ref: 'User' },
  relatedDeal: { type: Schema.Types.ObjectId, ref: 'Deal' },
  relatedContact: { type: Schema.Types.ObjectId, ref: 'Contact' },
  reminders: [{
    timestamp: { type: Date },
    sent: { type: Boolean, default: false }
  }],
  completedAt: { type: Date }
}, { timestamps: true });

// Middleware for completedAt logic
TaskSchema.pre('save', function() {
  if (this.isModified('status') && this.status === TaskStatus.COMPLETED) {
    this.completedAt = new Date();
  }
  
});

// Indexes
TaskSchema.index({ workspace: 1, assignee: 1 });
TaskSchema.index({ workspace: 1, status: 1 });
TaskSchema.index({ workspace: 1, dueDate: 1 });
TaskSchema.index({ relatedDeal: 1 });
TaskSchema.index({ relatedContact: 1 });

export const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
