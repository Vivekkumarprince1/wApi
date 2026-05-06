import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IOrderItem {
  productId?: Types.ObjectId;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

export interface IOrderAddress {
  name: string;
  phone: string;
  street: string;
  city: string;
  state?: string;
  pincode: string;
  country: string;
}

export interface IOrder {
  workspaceId: Types.ObjectId;
  contactId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  checkoutCartId?: Types.ObjectId;
  
  orderNumber: string;
  items: IOrderItem[];
  
  subtotal: number;
  tax: number;
  taxPercentage: number;
  shippingCost: number;
  discount: number;
  total: number;
  
  address: IOrderAddress;
  
  status: 'pending' | 'payment_initiated' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
  paymentMethod: 'cod' | 'razorpay' | 'stripe' | 'paypal' | 'upi';
  paymentStatus: 'pending' | 'initiated' | 'completed' | 'failed' | 'refunded';
  
  source: 'whatsapp_checkout_bot' | 'web_checkout' | 'mobile_app' | 'admin';
  
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
}

export interface IOrderDocument extends IOrder, Document {}

export interface IOrderModel extends Model<IOrderDocument> {
  generateOrderNumber(workspaceId: string | Types.ObjectId): string;
}

const OrderSchema = new Schema<IOrderDocument, IOrderModel>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  contactId: { type: Schema.Types.ObjectId, required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId },
  checkoutCartId: { type: Schema.Types.ObjectId },
  orderNumber: { type: String, required: true, unique: true, index: true },
  items: [Schema.Types.Mixed],
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  taxPercentage: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  address: Schema.Types.Mixed,
  status: { type: String, default: 'pending' },
  paymentMethod: { type: String, default: 'cod' },
  paymentStatus: { type: String, default: 'pending' },
  source: { type: String, default: 'whatsapp_checkout_bot' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date }
});

OrderSchema.statics.generateOrderNumber = function(workspaceId: string | Types.ObjectId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WO-${date}-${random}-${workspaceId.toString()}`;
};

export const Order = (mongoose.models.Order as IOrderModel) || mongoose.model<IOrderDocument, IOrderModel>('Order', OrderSchema);
