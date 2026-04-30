import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAutoReplyVariableMapping {
  variable: string;
  contactField: string;
  fallbackValue?: string;
}

export interface IAutoReply {
  workspace: Types.ObjectId;
  keywords: string[];
  matchMode: 'contains' | 'exact' | 'starts_with';
  triggerType: 'keyword' | 'always' | 'outside_business_hours';
  useWorkspaceBusinessHours: boolean;
  
  template?: Types.ObjectId;
  replyType: 'text' | 'template';
  textMessage?: string;
  variableMapping: IAutoReplyVariableMapping[];
  templateName?: string;
  languageCode?: string;
  
  enabled: boolean;
  totalRepliesSent: number;
  lastSentAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IAutoReplyDocument extends IAutoReply, Document {}

const AutoReplySchema = new Schema<IAutoReplyDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  
  keywords: {
    type: [String],
    default: [],
    validate: {
      validator: function(this: any, v: string[]) {
        if (this.triggerType === 'keyword') {
          return v && v.length > 0 && v.length <= 10;
        }
        return true;
      },
      message: 'Keywords are required for keyword-based auto-replies (max 10)'
    }
  },
  
  matchMode: { type: String, enum: ['contains', 'exact', 'starts_with'], default: 'contains' },
  triggerType: { type: String, enum: ['keyword', 'always', 'outside_business_hours'], default: 'keyword' },
  useWorkspaceBusinessHours: { type: Boolean, default: true },
  
  template: { type: Schema.Types.ObjectId, ref: 'Template' },
  replyType: { type: String, enum: ['text', 'template'], default: 'template' },
  textMessage: { type: String, trim: true },
  
  variableMapping: [{
    variable: String,
    contactField: String,
    fallbackValue: String
  }],
  
  templateName: String,
  languageCode: { type: String, default: 'en' },
  enabled: { type: Boolean, default: true },
  
  totalRepliesSent: { type: Number, default: 0 },
  lastSentAt: Date,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

AutoReplySchema.index({ workspace: 1 });
AutoReplySchema.index({ workspace: 1, enabled: 1 });

export const AutoReply = (mongoose.models.AutoReply as Model<IAutoReplyDocument>) || mongoose.model<IAutoReplyDocument>('AutoReply', AutoReplySchema);
