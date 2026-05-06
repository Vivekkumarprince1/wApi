import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { normalizePhoneNumber } from '../../utils/phone-utils';

export interface IContactMetadata {
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsappName?: string;
  [key: string]: any;
}

export interface IOptOut {
  status: boolean;
  optedOutAt?: Date;
  optedOutVia?: 'keyword' | 'manual' | 'webhook' | null;
  optedBackInAt?: Date;
}

export interface IContact {
  workspace: Types.ObjectId;
  name?: string;
  phone: string;
  tags: string[];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFields?: Map<string, any>;
  leadStatus: string;
  metadata: IContactMetadata;
  
  activeDealId?: Types.ObjectId;
  activePipelineId?: Types.ObjectId;
  assignedAgentId?: Types.ObjectId;
  
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
  
  optOut: IOptOut;
  isColdContact: boolean;
  
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  displayName: string;
}

export interface IContactDocument extends IContact, Document {}

export interface IContactModel extends Model<IContactDocument> {
  deleteByIdentifiers(identifiers: { workspaceId?: string | Types.ObjectId; phone?: string; email?: string }): Promise<{ deletedCount: number }>;
}

const ContactSchema = new Schema<IContactDocument, IContactModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String },
  phone: { type: String, required: true },
  tags: [String],
  
  customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
  leadStatus: { type: String, default: 'new' },

  metadata: { 
    type: Object, 
    default: {},
    firstName: String,
    lastName: String,
    email: String,
    whatsappName: String
  },
  
  activeDealId: { type: Schema.Types.ObjectId, ref: 'Deal' },
  activePipelineId: { type: Schema.Types.ObjectId, ref: 'Pipeline' },
  assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User' },
  
  lastInboundAt: { type: Date },
  lastOutboundAt: { type: Date },
  
  optOut: {
    status: { type: Boolean, default: false },
    optedOutAt: { type: Date },
    optedOutVia: { type: String, enum: ['keyword', 'manual', 'webhook'], default: null },
    optedBackInAt: { type: Date }
  },
  
  isColdContact: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

ContactSchema.virtual('displayName').get(function(this: IContactDocument) {
  const isValid = (val?: string) => val && val.trim() && val.toLowerCase() !== 'unknown';
  
  if (isValid(this.name)) return this.name!.trim();
  if (isValid(this.metadata?.whatsappName)) return this.metadata!.whatsappName!.trim();
  
  return this.phone;
});

ContactSchema.index({ workspace: 1, phone: 1 }, { unique: true });
ContactSchema.index({ workspace: 1, 'metadata.email': 1 });
ContactSchema.index({ workspace: 1, createdAt: -1 });
ContactSchema.index({ workspace: 1, updatedAt: -1 });
ContactSchema.index({ workspace: 1, tags: 1 });

ContactSchema.pre<IContactDocument>('save', function () {
  this.updatedAt = new Date();
  
  // Normalize phone number before saving
  if (this.phone) {
    this.phone = normalizePhoneNumber(this.phone);
  }
});

ContactSchema.statics.deleteByIdentifiers = async function(this: Model<IContactDocument>, { workspaceId, phone, email }) {
  const query: any = {};
  if (workspaceId) query.workspace = workspaceId;
  if (phone) query.phone = phone;
  if (email) query['metadata.email'] = email;

  if (Object.keys(query).length === 0) return { deletedCount: 0 };

  const res = await this.deleteMany(query);
  return { deletedCount: res.deletedCount || 0 };
};

export const Contact = (mongoose.models.Contact as IContactModel) || mongoose.model<IContactDocument, IContactModel>('Contact', ContactSchema);
