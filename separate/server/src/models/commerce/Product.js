const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // Basic Info
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return v >= 0 && !isNaN(v);
      },
      message: 'Price must be a valid number >= 0'
    }
  },
  
  currency: {
    type: String,
    enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'],
    default: 'INR'
  },
  
  // Inventory
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 0;
      },
      message: 'Stock must be a whole number >= 0'
    }
  },
  
  // Category & Organization
  category: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Media
  images: [
    {
      url: {
        type: String,
        required: true,
        trim: true
      },
      alt: {
        type: String,
        trim: true,
        maxlength: 200
      },
      isPrimary: {
        type: Boolean,
        default: false
      }
    }
  ],
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for common queries
ProductSchema.index({ workspaceId: 1, isDeleted: 1 });
ProductSchema.index({ workspaceId: 1, isActive: 1 });
ProductSchema.index({ workspaceId: 1, category: 1 });
ProductSchema.index({ workspaceId: 1, createdAt: -1 });

// Pre-save hook to update updatedAt
ProductSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Query helper to exclude soft-deleted products by default
ProductSchema.query.active = function() {
  return this.where({ isDeleted: false });
};

// Virtual to check if product is in stock
ProductSchema.virtual('inStock').get(function() {
  return this.stock > 0;
});

// Include virtuals in JSON
ProductSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', ProductSchema);
