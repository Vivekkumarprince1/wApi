const mongoose = require('mongoose');

const CommerceSettingsSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  
  // Feature enablement
  enabled: {
    type: Boolean,
    default: false
  },
  
  // Currency & Tax
  currency: {
    type: String,
    enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'],
    default: 'INR'
  },
  
  taxPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    validate: {
      validator: function(v) {
        return v >= 0 && v <= 100;
      },
      message: 'Tax percentage must be between 0 and 100'
    }
  },
  
  // Payment Methods
  paymentMethods: {
    cashOnDelivery: {
      enabled: { type: Boolean, default: true },
      instructions: { type: String }
    },
    razorpay: {
      enabled: { type: Boolean, default: false },
      keyId: { type: String },
      keySecret: { type: String }, // Will be encrypted in production
      webhookSecret: { type: String }
    },
    stripe: {
      enabled: { type: Boolean, default: false },
      publicKey: { type: String },
      secretKey: { type: String }, // Will be encrypted in production
      webhookSecret: { type: String }
    },
    paypal: {
      enabled: { type: Boolean, default: false },
      clientId: { type: String },
      clientSecret: { type: String }, // Will be encrypted in production
      mode: {
        type: String,
        enum: ['sandbox', 'live'],
        default: 'sandbox'
      }
    }
  },
  
  // Order Settings
  orderAutoConfirm: {
    type: Boolean,
    default: false
  },
  
  // Notifications
  notifications: {
    notifyAdminOnOrder: {
      type: Boolean,
      default: true
    },
    notifyCustomerOnOrder: {
      type: Boolean,
      default: true
    },
    notifyAdminOnPayment: {
      type: Boolean,
      default: true
    },
    notifyCustomerOnPayment: {
      type: Boolean,
      default: true
    },
    adminEmails: [{
      type: String,
      lowercase: true,
      validate: {
        validator: function(v) {
          return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
        },
        message: 'Invalid email format'
      }
    }]
  },
  
  // Shipping Settings
  shipping: {
    enabled: { type: Boolean, default: false },
    providers: [{
      name: String,
      apiKey: String,
      settings: mongoose.Schema.Types.Mixed
    }],
    flatRate: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number, default: 0 }
    },
    freeShippingAbove: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number }
    }
  },
  
  // Business Settings
  business: {
    storeDescription: { type: String },
    returnPolicy: { type: String },
    cancellationPolicy: { type: String },
    privacyPolicy: { type: String },
    termsConditions: { type: String }
  },
  
  // Integration & API
  webhookUrl: { type: String },
  apiKeysEnabled: { type: Boolean, default: false },
  
  // Audit
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Update timestamp on save
CommerceSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CommerceSettings', CommerceSettingsSchema);
