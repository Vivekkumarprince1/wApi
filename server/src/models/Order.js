const mongoose = require('mongoose');

/**
 * Order Model
 * Stores orders created from WhatsApp Checkout Bot
 */
const OrderSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
    index: true
  },
  
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  
  checkoutCartId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CheckoutCart'
  },
  
  // Order Identification
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Format: WO-{date}-{random}-{workspaceId}
    // Example: WO-20250129-5a3b2c-694a7e483cb8ed372b487bdb
  },
  
  // Items
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
    image: { type: String },
    _id: false
  }],
  
  // Pricing
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  taxPercentage: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountCode: { type: String },
  total: { type: Number, required: true },
  
  // Delivery Address
  address: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  
  // Order Status
  status: {
    type: String,
    enum: [
      'pending',           // Awaiting payment confirmation
      'payment_initiated', // Payment started
      'confirmed',         // Payment confirmed
      'processing',        // Being prepared
      'shipped',           // Out for delivery
      'delivered',         // Delivered
      'cancelled',         // Cancelled
      'failed'             // Payment failed
    ],
    default: 'pending',
    index: true
  },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['cod', 'razorpay', 'stripe', 'paypal', 'upi'],
    default: 'cod'
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'initiated', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  paymentId: { type: String }, // Payment gateway ID
  paymentDetails: {
    gateway: { type: String },
    transactionId: { type: String },
    receiptId: { type: String },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number }
  },
  
  // Timeline
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  
  // Notes & Tracking
  orderNotes: { type: String },
  adminNotes: { type: String },
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  
  // Communication
  notificationsSent: {
    order_created: { type: Boolean, default: false },
    payment_pending: { type: Boolean, default: false },
    payment_confirmed: { type: Boolean, default: false },
    order_shipped: { type: Boolean, default: false },
    order_delivered: { type: Boolean, default: false }
  },
  
  // Metadata
  source: { 
    type: String, 
    enum: ['whatsapp_checkout_bot', 'web_checkout', 'mobile_app', 'admin'],
    default: 'whatsapp_checkout_bot'
  },
  
  deviceInfo: {
    userAgent: { type: String },
    ipAddress: { type: String }
  }
});

// Indexes for common queries
OrderSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ workspaceId: 1, contactId: 1, createdAt: -1 });
OrderSchema.index({ workspaceId: 1, createdAt: -1 });
OrderSchema.index({ conversationId: 1 });
OrderSchema.index({ paymentId: 1 });

// Virtual for item count
OrderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Helper: Generate unique order number
OrderSchema.statics.generateOrderNumber = function(workspaceId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WO-${date}-${random}-${workspaceId}`;
};

// Helper: Update status with timestamp
OrderSchema.methods.updateStatus = function(newStatus) {
  const validTransitions = {
    'pending': ['payment_initiated', 'cancelled'],
    'payment_initiated': ['confirmed', 'failed', 'cancelled'],
    'confirmed': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered'],
    'delivered': [], // Terminal state
    'cancelled': [], // Terminal state
    'failed': ['pending'] // Can retry payment
  };
  
  if (!validTransitions[this.status]?.includes(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  
  // Update timeline
  if (newStatus === 'confirmed') this.confirmedAt = new Date();
  if (newStatus === 'shipped') this.shippedAt = new Date();
  if (newStatus === 'delivered') this.deliveredAt = new Date();
  if (newStatus === 'cancelled') this.cancelledAt = new Date();
  if (newStatus === 'payment_initiated') {
    this.paymentStatus = 'initiated';
  }
  
  return this;
};

// Helper: Mark as paid
OrderSchema.methods.markAsPaid = function(paymentId, gateway = 'razorpay') {
  this.paymentStatus = 'completed';
  this.paymentId = paymentId;
  this.paymentDetails = {
    ...this.paymentDetails,
    gateway,
    transactionId: paymentId,
    paidAt: new Date()
  };
  
  if (this.status === 'pending') {
    this.updateStatus('confirmed');
  }
  
  return this;
};

// Update timestamp on save
OrderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Query helper for workspace isolation
OrderSchema.query.byWorkspace = function(workspaceId) {
  return this.where({ workspaceId });
};

// Query helper for pending payments
OrderSchema.query.pendingPayment = function() {
  return this.where({ paymentStatus: 'pending' });
};

module.exports = mongoose.model('Order', OrderSchema);
