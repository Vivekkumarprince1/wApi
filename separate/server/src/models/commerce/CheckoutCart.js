const mongoose = require('mongoose');

/**
 * CheckoutCart Model
 * Stores conversation state for WhatsApp checkout bot
 * Tracks product selection, quantities, address, payment status
 */
const CheckoutCartSchema = new mongoose.Schema({
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
  
  // Bot State Machine
  state: {
    type: String,
    enum: [
      'welcome',           // Initial state
      'product_selection', // Showing products
      'quantity_selection',// Selected product, choosing quantity
      'address_capture',   // Capturing delivery address
      'payment_pending',   // Waiting for payment
      'order_completed',   // Order created
      'abandoned'          // Cart abandoned/expired
    ],
    default: 'welcome',
    index: true
  },
  
  // Current step context
  currentContext: {
    step: { type: String },
    selectedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    selectedProductName: { type: String },
    selectedProductPrice: { type: Number },
    selectedQuantity: { type: Number },
    selectedCategory: { type: String }
  },
  
  // Cart items (can have multiple)
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
    image: { type: String },
    _id: false
  }],
  
  // Totals
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  
  // Delivery Address
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
  
  // Payment Info
  paymentMethod: { type: String }, // 'cod', 'razorpay', 'stripe', etc.
  paymentStatus: {
    type: String,
    enum: ['pending', 'initiated', 'completed', 'failed'],
    default: 'pending'
  },
  paymentId: { type: String }, // Payment gateway transaction ID
  paymentError: { type: String },
  
  // Final Order Reference
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  
  // Bot Interaction Tracking
  lastInteractionAt: { type: Date, default: Date.now, index: true },
  messageCount: { type: Number, default: 0 },
  sessionStartedAt: { type: Date, default: Date.now },
  
  // Expiry
  expiresAt: { 
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    index: true
  },
  
  // Metadata
  metadata: {
    userAgent: { type: String },
    language: { type: String, default: 'en' },
    referralSource: { type: String }
  },
  
  // Audit
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
CheckoutCartSchema.index({ workspaceId: 1, contactId: 1 }, { unique: true });
CheckoutCartSchema.index({ workspaceId: 1, state: 1, lastInteractionAt: -1 });
CheckoutCartSchema.index({ workspaceId: 1, expiresAt: 1 }); // For expiry job
CheckoutCartSchema.index({ conversationId: 1 });

// Virtual for item count
CheckoutCartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual for is expired
CheckoutCartSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt && this.state !== 'order_completed';
});

// Helper: Calculate totals
CheckoutCartSchema.methods.calculateTotals = function(taxPercentage = 0, shippingCost = 0) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.tax = Math.round(this.subtotal * (taxPercentage / 100) * 100) / 100;
  this.shipping = shippingCost;
  this.total = this.subtotal + this.tax + this.shipping;
  return this;
};

// Helper: Add item to cart
CheckoutCartSchema.methods.addItem = function(product, quantity) {
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

// Helper: Remove item from cart
CheckoutCartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => 
    item.productId.toString() !== productId.toString()
  );
  return this;
};

// Helper: Clear cart
CheckoutCartSchema.methods.clearCart = function() {
  this.items = [];
  this.subtotal = 0;
  this.tax = 0;
  this.shipping = 0;
  this.total = 0;
  return this;
};

// Update timestamp on save
CheckoutCartSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Query helper to exclude expired carts
CheckoutCartSchema.query.active = function() {
  return this.where({ 
    expiresAt: { $gt: new Date() },
    state: { $ne: 'abandoned' }
  });
};

// Query helper to get abandoned carts
CheckoutCartSchema.query.abandoned = function() {
  return this.where({ 
    $or: [
      { expiresAt: { $lte: new Date() } },
      { state: 'abandoned' }
    ]
  });
};

module.exports = mongoose.model('CheckoutCart', CheckoutCartSchema);
