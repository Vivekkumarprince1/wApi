import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type SourceType = 'url' | 'document' | 'text';
export type CrawlStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface IAnswerBotSource {
  workspace: Types.ObjectId;
  sourceType: SourceType;
  title?: string;
  websiteUrl?: string;
  crawlStatus: CrawlStatus;
  textContent?: string;
  documentData?: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  };
  faqCount: number;
  errorMessage?: string;
  metadata: {
    pagesCrawled: number;
    totalPages?: number;
    questionsFound: number;
    crawlDurationMs?: number;
    lastCrawledAt?: Date;
  };
  completedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnswerBotSourceDocument extends IAnswerBotSource, Document {}

const AnswerBotSourceSchema = new Schema<IAnswerBotSourceDocument>({
  workspace: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  sourceType: {
    type: String,
    enum: ['url', 'document', 'text'],
    default: 'url',
    index: true
  },
  title: {
    type: String
  },
  websiteUrl: {
    type: String,
    required: function(this: any) { return this.sourceType === 'url'; },
    validate: {
      validator: function(this: any, v: string) {
        if (this.sourceType !== 'url') return true;
        try {
          new URL(v);
          return true;
        } catch (e) {
          return false;
        }
      },
      message: 'Invalid URL format'
    }
  },
  crawlStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  textContent: {
    type: String
  },
  documentData: {
    fileName: String,
    fileUrl: String,
    fileSize: Number,
    mimeType: String
  },
  faqCount: {
    type: Number,
    default: 0
  },
  errorMessage: String,
  metadata: {
    pagesCrawled: {
      type: Number,
      default: 0
    },
    totalPages: Number,
    questionsFound: {
      type: Number,
      default: 0
    },
    crawlDurationMs: Number,
    lastCrawledAt: Date
  },
  completedAt: Date,
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes
AnswerBotSourceSchema.index({ workspace: 1, crawlStatus: 1 });
AnswerBotSourceSchema.index({ workspace: 1, createdAt: -1 });
AnswerBotSourceSchema.index({ workspace: 1, websiteUrl: 1 }, { unique: true, sparse: true });

export const AnswerBotSource: Model<IAnswerBotSourceDocument> = (mongoose.models.AnswerBotSource as Model<IAnswerBotSourceDocument>) || mongoose.model<IAnswerBotSourceDocument>('AnswerBotSource', AnswerBotSourceSchema);
