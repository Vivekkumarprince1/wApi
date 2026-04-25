import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IInteraktiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface IInteraktiveListSection {
  title: string;
  rows: IInteraktiveListRow[];
}

export interface IInteraktiveList {
  workspace: Types.ObjectId;
  name: string;
  description?: string;
  enabled: boolean;
  triggerKeywords: string[];
  message: {
    header?: string;
    body: string;
    footer?: string;
    buttonText: string;
    sections: IInteraktiveListSection[];
  };
  stats: {
    sentCount: number;
    lastSentAt?: Date;
  };
  deletedAt?: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInteraktiveListDocument extends IInteraktiveList, Document {}

const InteraktiveListSchema = new Schema<IInteraktiveListDocument>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    triggerKeywords: { type: [String], default: [] },
    message: {
      header: { type: String, trim: true },
      body: { type: String, required: true, trim: true },
      footer: { type: String, trim: true },
      buttonText: { type: String, default: 'Choose Option', trim: true },
      sections: {
        type: [
          {
            title: { type: String, required: true, trim: true },
            rows: {
              type: [
                {
                  id: { type: String, required: true, trim: true },
                  title: { type: String, required: true, trim: true },
                  description: { type: String, trim: true },
                },
              ],
              default: [],
            },
          },
        ],
        default: [],
      },
    },
    stats: {
      sentCount: { type: Number, default: 0 },
      lastSentAt: { type: Date },
    },
    deletedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

InteraktiveListSchema.index({ workspace: 1, deletedAt: 1, createdAt: -1 });
InteraktiveListSchema.index({ workspace: 1, enabled: 1, deletedAt: 1 });

export const InteraktiveList: Model<IInteraktiveListDocument> =
  (mongoose.models.InteraktiveList as Model<IInteraktiveListDocument>) ||
  mongoose.model<IInteraktiveListDocument>('InteraktiveList', InteraktiveListSchema);
