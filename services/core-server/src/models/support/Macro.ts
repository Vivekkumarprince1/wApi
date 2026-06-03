import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMacro extends Document {
  workspace: Types.ObjectId;
  name: string;
  shortcut: string;
  content: string;
  description?: string;
  category?: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MacroSchema = new Schema<IMacro>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  shortcut: { type: String, trim: true, index: true },
  content: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'general' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

if (mongoose.models.Macro) {
  delete mongoose.models.Macro;
}
export const Macro = mongoose.model<IMacro>('Macro', MacroSchema);
