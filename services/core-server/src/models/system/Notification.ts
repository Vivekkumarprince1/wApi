import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotification {
  workspace: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  type: 'invitation_accepted' | 'invitation_declined' | 'system_alert' | 'billing_alert';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { 
      type: String, 
      enum: ['invitation_accepted', 'invitation_declined', 'system_alert', 'billing_alert'],
      required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Auto-delete notifications after 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const Notification: Model<INotificationDocument> = 
  mongoose.models.Notification || mongoose.model<INotificationDocument>("Notification", NotificationSchema);
