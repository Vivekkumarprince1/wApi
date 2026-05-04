import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification {
  workspace: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId; // User ID
  type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'campaign' | 'billing' | 'system';
  title: string;
  body: string;
  metadata?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const NotificationSchema = new Schema<INotificationDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { 
    type: String, 
    enum: ['info', 'success', 'warning', 'error', 'assignment', 'campaign', 'billing', 'system'],
    default: 'info' 
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  link: { type: String },
}, {
  timestamps: true
});

// Index for fetching unread count quickly
NotificationSchema.index({ recipient: 1, read: 1 });
// TTL index: auto-delete notifications after 30 days to keep DB lean
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const Notification = (mongoose.models.Notification as Model<INotificationDocument>) || mongoose.model<INotificationDocument>('Notification', NotificationSchema);
