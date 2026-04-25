import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IInvoiceSequence {
  prefix: string; // e.g. "INV-202404-"
  lastNumber: number;
}

export interface IInvoiceSequenceDocument extends IInvoiceSequence, Document {}

const InvoiceSequenceSchema = new Schema<IInvoiceSequenceDocument>({
  prefix: { type: String, required: true, unique: true },
  lastNumber: { type: Number, default: 0 }
}, { timestamps: true });

export const InvoiceSequence: Model<IInvoiceSequenceDocument> = 
  mongoose.models.InvoiceSequence || mongoose.model<IInvoiceSequenceDocument>('InvoiceSequence', InvoiceSequenceSchema);
