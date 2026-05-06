import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISupportTicket extends Document {
  workspace: Types.ObjectId;
  subject: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  contact?: Types.ObjectId;
  lastResponseAt?: Date;
  resolvedAt?: Date;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  category: { type: String, default: 'general' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact' },
  lastResponseAt: { type: Date },
  resolvedAt: { type: Date },
  tags: [{ type: String }],
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
