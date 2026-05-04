import mongoose, { Schema, Document, Model } from 'mongoose';

export enum DealStatus {
  ACTIVE = 'active',
  WON = 'won',
  LOST = 'lost',
  ARCHIVED = 'archived'
}

export enum DealPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface IDealNote {
  text: string;
  author: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IDealStageHistory {
  stage: string;
  timestamp: Date;
  changedBy: mongoose.Types.ObjectId;
}

export interface IDealActivity {
  type: 'stage_change' | 'note_added' | 'assigned' | 'status_change' | 'attribute_update' | 'created';
  text: string;
  payload?: any;
  author: mongoose.Types.ObjectId;
  timestamp: Date;
}

export interface IDeal extends Document {
  workspace: mongoose.Types.ObjectId;
  contact: mongoose.Types.ObjectId;
  pipeline: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  value: number;
  currency: string;
  stage: string;
  assignedAgent?: mongoose.Types.ObjectId;
  status: DealStatus;
  probability: number;
  expectedCloseDate?: Date;
  priority: DealPriority;
  winLossReason?: string;
  source: string;
  sourceId?: mongoose.Types.ObjectId;
  notes: IDealNote[];
  stageHistory: IDealStageHistory[];
  activityLog: IDealActivity[];
  attributes: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

const DealSchema: Schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  pipeline: { type: Schema.Types.ObjectId, ref: 'Pipeline', required: true },
  title: { type: String, required: true },
  description: { type: String },
  value: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  stage: { type: String, required: true },
  assignedAgent: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: Object.values(DealStatus),
    default: DealStatus.ACTIVE
  },
  probability: { type: Number, min: 0, max: 100, default: 10 },
  expectedCloseDate: { type: Date },
  priority: { 
    type: String, 
    enum: Object.values(DealPriority),
    default: DealPriority.MEDIUM 
  },
  winLossReason: { type: String },
  source: { 
    type: String, 
    default: 'manual' 
  },
  sourceId: { type: Schema.Types.ObjectId },
  notes: [
    {
      text: String,
      author: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  stageHistory: [
    {
      stage: String,
      timestamp: { type: Date, default: Date.now },
      changedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  activityLog: [
    {
      type: { type: String },
      text: String,
      payload: Schema.Types.Mixed,
      author: { type: Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  attributes: { type: Object, default: {} },
  closedAt: { type: Date }
}, { timestamps: true });

// Indexing for performance
DealSchema.index({ workspace: 1, contact: 1 });
DealSchema.index({ workspace: 1, stage: 1 });
DealSchema.index({ workspace: 1, status: 1 });
DealSchema.index({ pipeline: 1, stage: 1 });

export const Deal: Model<IDeal> = mongoose.models.Deal || mongoose.model<IDeal>('Deal', DealSchema);
