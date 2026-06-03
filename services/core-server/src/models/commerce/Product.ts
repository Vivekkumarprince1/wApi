import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * PRODUCT MODEL - Stage 8 (Commerce Catalogue)
 */

export interface IProductImage {
  url: string;
  alt?: string;
  isPrimary: boolean;
}

export interface IProduct extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'AED' | 'SAR' | 'KWD' | 'QAR' | 'BHD' | 'OMR';
  stock: number;
  category?: string;
  images: IProductImage[];
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false }
}, { _id: false });

const ProductSchema: Schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  currency: { 
    type: String, 
    enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'], 
    default: 'INR' 
  },
  stock: { type: Number, required: true, min: 0, default: 0 },
  category: { type: String, trim: true },
  images: [ProductImageSchema],
  isActive: { type: Boolean, default: true, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Virtual for stock check
ProductSchema.virtual('inStock').get(function(this: IProduct) {
  return this.stock > 0;
});

// JSON settings for virtuals
ProductSchema.set('toJSON', { virtuals: true });

export const Product: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
