import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICheckoutCartItem {
  productId: Types.ObjectId;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

export interface ICheckoutCartAddress {
  name?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  isComplete: boolean;
}

export interface ICheckoutCart {
  workspaceId: Types.ObjectId;
  contactId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  
  state: 'welcome' | 'product_selection' | 'quantity_selection' | 'address_capture' | 'payment_pending' | 'order_completed' | 'abandoned';
  currentContext?: {
    step?: string;
    selectedProductId?: Types.ObjectId;
    selectedProductName?: string;
    selectedProductPrice?: number;
    selectedQuantity?: number;
    selectedCategory?: string;
  };
  
  items: ICheckoutCartItem[];
  
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  
  address: ICheckoutCartAddress;
  
  paymentMethod?: string;
  paymentStatus: 'pending' | 'initiated' | 'completed' | 'failed';
  paymentId?: string;
  paymentError?: string;
  
  orderId?: Types.ObjectId;
  
  lastInteractionAt: Date;
  messageCount: number;
  sessionStartedAt: Date;
  
  expiresAt: Date;
  
  metadata?: {
    userAgent?: string;
    language?: string;
    referralSource?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ICheckoutCartDocument extends ICheckoutCart, Document {
  itemCount: number;
  isExpired: boolean;
  calculateTotals(taxPercentage?: number, shippingCost?: number): ICheckoutCartDocument;
  addItem(product: any, quantity: number): ICheckoutCartDocument;
  removeItem(productId: Types.ObjectId | string): ICheckoutCartDocument;
  clearCart(): ICheckoutCartDocument;
}

const CheckoutCartSchema = new Schema<ICheckoutCartDocument>({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  
  state: {
    type: String,
    enum: ['welcome', 'product_selection', 'quantity_selection', 'address_capture', 'payment_pending', 'order_completed', 'abandoned'],
    default: 'welcome',
    index: true
  },
  
  currentContext: {
    step: { type: String },
    selectedProductId: { type: Schema.Types.ObjectId, ref: 'Product' },
    selectedProductName: { type: String },
    selectedProductPrice: { type: Number },
    selectedQuantity: { type: Number },
    selectedCategory: { type: String }
  },
  
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
    image: { type: String },
    _id: false
  }],
  
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  
  address: {
    name: { type: String },
    phone: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: 'India' },
    isComplete: { type: Boolean, default: false }
  },
  
  paymentMethod: { type: String },
  paymentStatus: { type: String, enum: ['pending', 'initiated', 'completed', 'failed'], default: 'pending' },
  paymentId: { type: String },
  paymentError: { type: String },
  
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  
  lastInteractionAt: { type: Date, default: Date.now, index: true },
  messageCount: { type: Number, default: 0 },
  sessionStartedAt: { type: Date, default: Date.now },
  
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: true },
  
  metadata: {
    userAgent: { type: String },
    language: { type: String, default: 'en' },
    referralSource: { type: String }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CheckoutCartSchema.index({ workspaceId: 1, contactId: 1 }, { unique: true });
CheckoutCartSchema.index({ workspaceId: 1, state: 1, lastInteractionAt: -1 });

CheckoutCartSchema.virtual('itemCount').get(function(this: ICheckoutCartDocument) {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

CheckoutCartSchema.virtual('isExpired').get(function(this: ICheckoutCartDocument) {
  return new Date() > this.expiresAt && this.state !== 'order_completed';
});

CheckoutCartSchema.methods.calculateTotals = function(this: ICheckoutCartDocument, taxPercentage = 0, shippingCost = 0) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.tax = Math.round(this.subtotal * (taxPercentage / 100) * 100) / 100;
  this.shipping = shippingCost;
  this.total = this.subtotal + this.tax + this.shipping;
  return this;
};

CheckoutCartSchema.methods.addItem = function(this: ICheckoutCartDocument, product: any, quantity: number) {
  const existingItem = this.items.find(item => item.productId.toString() === product._id.toString());
  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.subtotal = existingItem.price * existingItem.quantity;
  } else {
    this.items.push({
      productId: product._id,
      productName: product.name,
      price: product.price,
      quantity,
      subtotal: product.price * quantity,
      image: product.images?.[0]?.url
    });
  }
  return this;
};

CheckoutCartSchema.methods.removeItem = function(this: ICheckoutCartDocument, productId: Types.ObjectId | string) {
  this.items = this.items.filter(item => item.productId.toString() !== productId.toString());
  return this;
};

CheckoutCartSchema.methods.clearCart = function(this: ICheckoutCartDocument) {
  this.items = [];
  this.subtotal = 0;
  this.tax = 0;
  this.shipping = 0;
  this.total = 0;
  return this;
};

CheckoutCartSchema.pre<ICheckoutCartDocument>('save', function() {
  this.updatedAt = new Date();
});

export const CheckoutCart = (mongoose.models.CheckoutCart as Model<ICheckoutCartDocument>) || mongoose.model<ICheckoutCartDocument>('CheckoutCart', CheckoutCartSchema);
