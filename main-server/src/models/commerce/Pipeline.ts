import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPipelineStage {
  id: string;
  title: string;
  position: number;
  isFinal?: boolean;
  color?: string;
}

export interface IPipeline extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  stages: IPipelineStage[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PipelineSchema: Schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  description: { type: String },
  stages: [
    {
      id: { type: String, required: true },
      title: { type: String, required: true },
      position: { type: Number, required: true },
      isFinal: { type: Boolean, default: false },
      color: { type: String, default: '#6B7280' }
    }
  ],
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

// Ensure unique pipeline names per workspace
PipelineSchema.index({ workspace: 1, name: 1 }, { unique: true });
PipelineSchema.index({ workspace: 1, isDefault: 1 });

// Prevent multiple defaults per workspace logic would be in service/controller
// but index helps with querying

export const Pipeline: Model<IPipeline> = mongoose.models.Pipeline || mongoose.model<IPipeline>('Pipeline', PipelineSchema);
