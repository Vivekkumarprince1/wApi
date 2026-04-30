import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ISegment {
  workspace: Types.ObjectId;
  name: string;
  description?: string;
  filters: {
    tags?: string[];
    notTags?: string[];
    status?: string[];
    lastSeenBefore?: Date;
    lastSeenAfter?: Date;
    hasActivity?: boolean;
    activityType?: string;
    customQuery?: any;
  };
  contactCount: number;
  lastResolvedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISegmentDocument extends ISegment, Document {}

const SegmentSchema = new Schema<ISegmentDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  filters: {
    tags: [String],
    notTags: [String],
    status: [String],
    lastSeenBefore: Date,
    lastSeenAfter: Date,
    hasActivity: Boolean,
    activityType: String,
    customQuery: { type: Schema.Types.Mixed }
  },
  contactCount: { type: Number, default: 0 },
  lastResolvedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

SegmentSchema.index({ workspace: 1, name: 1 });

export const Segment = (mongoose.models.Segment as Model<ISegmentDocument>) || mongoose.model<ISegmentDocument>('Segment', SegmentSchema);
