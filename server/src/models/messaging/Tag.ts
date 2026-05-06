import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ITagUsageCount {
  contacts: number;
  conversations: number;
  total: number;
}

export interface ITag {
  workspace: Types.ObjectId;
  name: string;
  normalizedName: string;
  color: string;
  description?: string;
  scope: 'all' | 'contacts' | 'conversations';
  usageCount: ITagUsageCount;
  isSystem: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITagDocument extends ITag, Document { }

export interface ITagModel extends Model<ITagDocument> {
  findOrCreate(workspaceId: string | Types.ObjectId, tagName: string, userId?: string | Types.ObjectId | null): Promise<ITagDocument>;
  incrementUsage(workspaceId: string | Types.ObjectId, tagName: string, type?: string): Promise<ITagDocument | null>;
  decrementUsage(workspaceId: string | Types.ObjectId, tagName: string, type?: string): Promise<ITagDocument | null>;
  getPopularTags(workspaceId: string | Types.ObjectId, limit?: number): Promise<any[]>;
  searchByPrefix(workspaceId: string | Types.ObjectId, prefix: string, limit?: number): Promise<any[]>;
}

const TagSchema = new Schema<ITagDocument, ITagModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  normalizedName: { type: String, lowercase: true, trim: true },
  color: { type: String, default: '#6B7280' },
  description: { type: String, maxlength: 200 },
  scope: { type: String, enum: ['all', 'contacts', 'conversations'], default: 'all' },
  usageCount: {
    contacts: { type: Number, default: 0 },
    conversations: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TagSchema.index({ workspace: 1, normalizedName: 1 }, { unique: true });
TagSchema.index({ workspace: 1, createdAt: -1 });
TagSchema.index({ workspace: 1, 'usageCount.total': -1 });

TagSchema.pre<ITagDocument>('save', function () {
  this.normalizedName = this.name.toLowerCase().trim();
  this.updatedAt = new Date();
  
});

TagSchema.statics.findOrCreate = async function (workspaceId, tagName, userId = null) {
  const normalizedName = tagName.toLowerCase().trim();
  let tag = await this.findOne({ workspace: workspaceId, normalizedName });
  if (!tag) {
    tag = await this.create({ workspace: workspaceId, name: tagName.trim(), normalizedName, createdBy: userId });
  }
  return tag;
};

TagSchema.statics.incrementUsage = async function (workspaceId, tagName, type = 'contacts') {
  const normalizedName = tagName.toLowerCase().trim();
  const field = type === 'contacts' ? 'usageCount.contacts' : 'usageCount.conversations';
  return this.findOneAndUpdate({ workspace: workspaceId, normalizedName }, { $inc: { [field]: 1, 'usageCount.total': 1 } }, { returnDocument: 'after' });
};

TagSchema.statics.decrementUsage = async function (workspaceId, tagName, type = 'contacts') {
  const normalizedName = tagName.toLowerCase().trim();
  const field = type === 'contacts' ? 'usageCount.contacts' : 'usageCount.conversations';
  return this.findOneAndUpdate({ workspace: workspaceId, normalizedName }, { $inc: { [field]: -1, 'usageCount.total': -1 } }, { returnDocument: 'after' });
};

TagSchema.statics.getPopularTags = async function (workspaceId, limit = 20) {
  return this.find({ workspace: workspaceId }).sort({ 'usageCount.total': -1 }).limit(limit).lean();
};

TagSchema.statics.searchByPrefix = async function (workspaceId, prefix, limit = 10) {
  return this.find({ workspace: workspaceId, normalizedName: { $regex: `^${prefix.toLowerCase().trim()}`, $options: 'i' } }).sort({ 'usageCount.total': -1 }).limit(limit).lean();
};

export const Tag = (mongoose.models.Tag as ITagModel) || mongoose.model<ITagDocument, ITagModel>('Tag', TagSchema);
