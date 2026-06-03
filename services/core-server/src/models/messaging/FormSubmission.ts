import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Persisted record of a WhatsApp Flow / form submission. The
 * automation-service receives the inbound submission and forwards it via
 * the internal `record_form_submission` action; the monolith stores it
 * here so it can be displayed in the inbox / contact timeline.
 */
export interface IFormSubmission {
  workspace: Types.ObjectId;
  contact?: Types.ObjectId;
  conversation?: Types.ObjectId;

  /** Provider flow token used to correlate with the original prompt. */
  flowToken: string;
  /** Optional source flow identifier (template / flow id). */
  flowId?: string;
  /** Submission payload as it came back from the provider. */
  data: Record<string, unknown>;
  /** Provider metadata (sender, timestamps, etc.). */
  metadata?: Record<string, unknown>;
  /** Free-form options the caller wanted persisted. */
  options?: Record<string, unknown>;

  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFormSubmissionDocument extends IFormSubmission, Document {}

const FormSubmissionSchema = new Schema<IFormSubmissionDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
  flowToken: { type: String, required: true, index: true },
  flowId: { type: String },
  data: { type: Schema.Types.Mixed, default: {} },
  metadata: { type: Schema.Types.Mixed },
  options: { type: Schema.Types.Mixed },
  receivedAt: { type: Date, default: () => new Date() },
}, {
  timestamps: true,
});

FormSubmissionSchema.index({ workspace: 1, flowToken: 1 }, { unique: true });
FormSubmissionSchema.index({ workspace: 1, receivedAt: -1 });
FormSubmissionSchema.index({ workspace: 1, contact: 1, receivedAt: -1 });

export const FormSubmission: Model<IFormSubmissionDocument> =
  mongoose.models.FormSubmission ||
  mongoose.model<IFormSubmissionDocument>('FormSubmission', FormSubmissionSchema);
