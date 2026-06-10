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

export interface IOrderPaymentDetails {
  gateway?: string;
  transactionId?: string;
  receiptId?: string;
  paidAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
}

export interface IOrderDeviceInfo {
  userAgent?: string;
  ipAddress?: string;
}

export interface IOrderNotificationsSent {
  order_created: boolean;
  payment_pending: boolean;
  payment_confirmed: boolean;
  order_shipped: boolean;
  order_delivered: boolean;
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
  discountCode?: string;
  total: number;
  
  address: IOrderAddress;
  
  status: 'pending' | 'payment_initiated' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
  
  paymentMethod: 'cod' | 'razorpay' | 'stripe' | 'paypal' | 'upi';
  paymentStatus: 'pending' | 'initiated' | 'completed' | 'failed' | 'refunded';
  paymentId?: string;
  paymentDetails?: IOrderPaymentDetails;
  
  orderNotes?: string;
  adminNotes?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  
  notificationsSent: IOrderNotificationsSent;
  
  source: 'whatsapp_checkout_bot' | 'web_checkout' | 'mobile_app' | 'admin';
  deviceInfo?: IOrderDeviceInfo;
  
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
}

export interface IOrderDocument extends IOrder, Document {
  itemCount: number;
  updateStatus(newStatus: string): IOrderDocument;
  markAsPaid(paymentId: string, gateway?: string): IOrderDocument;
}

export interface IOrderModel extends Model<IOrderDocument> {
  generateOrderNumber(workspaceId: string | Types.ObjectId): string;
}

const OrderSchema = new Schema<IOrderDocument, IOrderModel>({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  contactId: { type: Schema.Types.ObjectId, required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId },
  checkoutCartId: { type: Schema.Types.ObjectId },
  
  orderNumber: { type: String, required: true, unique: true, index: true },
  
  items: [{
    productId: { type: Schema.Types.ObjectId },
    productName: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
    image: { type: String },
    _id: false
  }],
  
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  taxPercentage: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountCode: { type: String },
  total: { type: Number, required: true },
  
  address: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  
  status: {
    type: String,
    enum: ['pending', 'payment_initiated', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'],
    default: 'pending',
    index: true
  },
  
  paymentMethod: { type: String, enum: ['cod', 'razorpay', 'stripe', 'paypal', 'upi'], default: 'cod' },
  paymentStatus: { type: String, enum: ['pending', 'initiated', 'completed', 'failed', 'refunded'], default: 'pending' },
  paymentId: { type: String },
  paymentDetails: {
    gateway: { type: String },
    transactionId: { type: String },
    receiptId: { type: String },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number }
  },
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  
  orderNotes: { type: String },
  adminNotes: { type: String },
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  
  notificationsSent: {
    order_created: { type: Boolean, default: false },
    payment_pending: { type: Boolean, default: false },
    payment_confirmed: { type: Boolean, default: false },
    order_shipped: { type: Boolean, default: false },
    order_delivered: { type: Boolean, default: false }
  },
  
  source: { type: String, enum: ['whatsapp_checkout_bot', 'web_checkout', 'mobile_app', 'admin'], default: 'whatsapp_checkout_bot' },
  deviceInfo: { userAgent: { type: String }, ipAddress: { type: String } }
});

OrderSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ workspaceId: 1, contactId: 1, createdAt: -1 });

OrderSchema.virtual('itemCount').get(function(this: IOrderDocument) {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

OrderSchema.statics.generateOrderNumber = function(workspaceId: string | Types.ObjectId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WO-${date}-${random}-${workspaceId.toString()}`;
};

OrderSchema.methods.updateStatus = function(this: IOrderDocument, newStatus: string) {
  const validTransitions: Record<string, string[]> = {
    'pending': ['payment_initiated', 'cancelled'],
    'payment_initiated': ['confirmed', 'failed', 'cancelled'],
    'confirmed': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered'],
    'delivered': [],
    'cancelled': [],
    'failed': ['pending']
  };
  
  if (!validTransitions[this.status]?.includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus as any;
  if (newStatus === 'confirmed') this.confirmedAt = new Date();
  if (newStatus === 'shipped') this.shippedAt = new Date();
  if (newStatus === 'delivered') this.deliveredAt = new Date();
  if (newStatus === 'cancelled') this.cancelledAt = new Date();
  if (newStatus === 'payment_initiated') this.paymentStatus = 'initiated';
  
  return this;
};

OrderSchema.methods.markAsPaid = function(this: IOrderDocument, paymentId: string, gateway = 'razorpay') {
  this.paymentStatus = 'completed';
  this.paymentId = paymentId;
  this.paymentDetails = { ...this.paymentDetails, gateway, transactionId: paymentId, paidAt: new Date() };
  if (this.status === 'pending' || this.status === 'payment_initiated') {
    this.status = 'confirmed';
    this.confirmedAt = new Date();
  }
  return this;
};

OrderSchema.pre<IOrderDocument>('save', function() {
  this.updatedAt = new Date();
});

export const OrderModel = mongoose.model<IOrderDocument, IOrderModel>('Order', OrderSchema);
