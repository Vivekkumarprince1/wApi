import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IContactEvent {
  workspace: Types.ObjectId;
  contact: Types.ObjectId;
  type: string;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  createdBy?: Types.ObjectId;
  createdAt: Date;
}

export interface IContactEventDocument extends IContactEvent, Document {}

const ContactEventSchema = new Schema<IContactEventDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  type: { type: String, required: true },
  description: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

ContactEventSchema.index({ workspace: 1, contact: 1, createdAt: -1 });

export const ContactEvent = (mongoose.models.ContactEvent as Model<IContactEventDocument>) || mongoose.model<IContactEventDocument>('ContactEvent', ContactEventSchema);
