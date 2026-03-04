/**
 * WidgetConfig Model
 * 
 * Manages WhatsApp widget configuration for embedding on customer websites.
 * Similar to Interakt's widget, fully backend-controlled with secure embed.js delivery.
 * 
 * REUSED PATTERNS:
 * - Workspace-based multi-tenancy (from Integration, CommerceSettings)
 * - Plan-based feature access (from Integration)
 * - Audit trail (createdBy, updatedBy) (from Integration)
 * - Timestamped schema (from Integration, Campaign)
 * 
 * NEW IMPLEMENTATION:
 * - Widget embed.js caching mechanism
 * - Position and styling configuration
 * - Greeting text customization
 * - Default message template
 * - Attribution control (Interakt-style)
 */

const mongoose = require('mongoose');

const WidgetConfigSchema = new mongoose.Schema({
  // Multi-tenant isolation (required for all workspace features)
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true // Query by workspace
  },

  // Widget Activation
  enabled: {
    type: Boolean,
    default: false // Off by default
  },

  // Widget Display Position
  // Options: bottom-right, bottom-left, top-right, top-left, full-width-bottom
  position: {
    type: String,
    enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'full-width-bottom'],
    default: 'bottom-right'
  },

  // Widget Styling
  color: {
    // Primary color in hex format
    primary: {
      type: String,
      default: '#25D366', // WhatsApp green
      validate: {
        validator: (v) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v),
        message: 'Invalid hex color format'
      }
    },
    // Secondary color for hover/focus states
    secondary: {
      type: String,
      default: '#1ea652',
      validate: {
        validator: (v) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v),
        message: 'Invalid hex color format'
      }
    },
    // Text color
    text: {
      type: String,
      default: '#ffffff',
      validate: {
        validator: (v) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v),
        message: 'Invalid hex color format'
      }
    }
  },

  // Widget Greeting & Messages
  greeting: {
    // Main greeting text shown when widget opens
    text: {
      type: String,
      default: 'Welcome! How can we help?',
      maxlength: 200
    },
    // Subtext shown below greeting
    subtext: {
      type: String,
      maxlength: 200
    },
    // Show/hide greeting
    enabled: {
      type: Boolean,
      default: true
    }
  },

  // Default message to send when user starts conversation
  defaultMessage: {
    type: String,
    default: 'Hello! Thanks for reaching out.',
    maxlength: 1024
  },

  // Conversation Settings
  conversation: {
    // Enable/disable message history
    showHistory: {
      type: Boolean,
      default: true
    },
    // Auto-close after inactivity (minutes, 0 = never)
    autoCloseAfter: {
      type: Number,
      default: 0
    },
    // Max messages before requiring contact info
    maxMessagesBeforeCollection: {
      type: Number,
      default: 5
    },
    // Collect phone number
    collectPhoneNumber: {
      type: Boolean,
      default: false
    },
    // Collect email
    collectEmail: {
      type: Boolean,
      default: true
    },
    // Collect name
    collectName: {
      type: Boolean,
      default: true
    }
  },

  // Widget Behavior
  behavior: {
    // Show widget by default or require user to open
    showByDefault: {
      type: Boolean,
      default: false
    },
    // Button label when collapsed
    buttonLabel: {
      type: String,
      default: 'Chat with us',
      maxlength: 50
    },
    // Show/hide on specific pages (glob patterns)
    allowedPages: {
      type: [String],
      default: ['*'] // Show on all pages by default
    },
    // Hide on specific pages (glob patterns)
    excludedPages: {
      type: [String],
      default: []
    },
    // Delay before showing widget (seconds)
    delayBeforeShow: {
      type: Number,
      default: 0
    }
  },

  // Attribution (like Interakt - "Powered by...")
  attribution: {
    // Show "Powered by Interakt" style badge
    enabled: {
      type: Boolean,
      default: true
    },
    // Custom attribution text
    customText: {
      type: String,
      maxlength: 100
    }
  },

  // Widget Analytics & Usage
  usage: {
    // Sessions per month
    sessionsThisMonth: {
      type: Number,
      default: 0
    },
    // Messages sent via widget this month
    messagesThisMonth: {
      type: Number,
      default: 0
    },
    // Unique visitors this month
    uniqueVisitorsThisMonth: {
      type: Number,
      default: 0
    },
    // Last activity
    lastActivityAt: {
      type: Date
    }
  },

  // Embed Cache
  embed: {
    // Cached embed.js content (minified)
    cachedScript: {
      type: String
    },
    // Cache timestamp
    cachedAt: {
      type: Date
    },
    // Cache version (for invalidation)
    cacheVersion: {
      type: Number,
      default: 1
    }
  },

  // Audit Trail
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
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ============================================================================
// INDEXES
// ============================================================================

// Query for active widgets (for cache invalidation)
// Note: workspace already has index: true in field definition (line 26)
WidgetConfigSchema.index({ workspace: 1, enabled: 1 });

// ============================================================================
// INSTANCE METHODS
// ============================================================================

/**
 * Get safe JSON (for API responses, excludes large cached script)
 */
WidgetConfigSchema.methods.toSafeJSON = function() {
  return {
    id: this._id,
    enabled: this.enabled,
    position: this.position,
    color: this.color,
    greeting: this.greeting,
    defaultMessage: this.defaultMessage,
    conversation: this.conversation,
    behavior: this.behavior,
    attribution: this.attribution,
    usage: this.usage,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/**
 * Validate configuration
 * Returns { valid: boolean, errors: string[] }
 */
WidgetConfigSchema.methods.validateConfig = function() {
  const errors = [];

  // Validate required fields
  if (!this.greeting?.text || this.greeting.text.trim().length === 0) {
    errors.push('Greeting text is required');
  }

  if (!this.defaultMessage || this.defaultMessage.trim().length === 0) {
    errors.push('Default message is required');
  }

  // Validate color format
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (this.color?.primary && !colorRegex.test(this.color.primary)) {
    errors.push('Invalid primary color format');
  }
  if (this.color?.secondary && !colorRegex.test(this.color.secondary)) {
    errors.push('Invalid secondary color format');
  }
  if (this.color?.text && !colorRegex.test(this.color.text)) {
    errors.push('Invalid text color format');
  }

  // Validate numeric fields
  if (this.behavior?.delayBeforeShow < 0) {
    errors.push('Delay cannot be negative');
  }
  if (this.conversation?.autoCloseAfter < 0) {
    errors.push('Auto-close timeout cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Mark widget viewed (update last activity)
 */
WidgetConfigSchema.methods.markActivity = function(sessions = 0, messages = 0, visitors = 0) {
  this.usage.sessionsThisMonth += sessions;
  this.usage.messagesThisMonth += messages;
  this.usage.uniqueVisitorsThisMonth += visitors;
  this.usage.lastActivityAt = new Date();
  return this.save();
};

/**
 * Reset monthly usage counters
 */
WidgetConfigSchema.methods.resetMonthlyUsage = function() {
  this.usage.sessionsThisMonth = 0;
  this.usage.messagesThisMonth = 0;
  this.usage.uniqueVisitorsThisMonth = 0;
  return this.save();
};

/**
 * Update embed cache with new script
 */
WidgetConfigSchema.methods.updateCache = function(scriptContent) {
  this.embed.cachedScript = scriptContent;
  this.embed.cachedAt = new Date();
  this.embed.cacheVersion = (this.embed.cacheVersion || 0) + 1;
  return this.save();
};

/**
 * Clear embed cache (forces regeneration on next request)
 */
WidgetConfigSchema.methods.clearCache = function() {
  this.embed.cachedScript = null;
  this.embed.cachedAt = null;
  return this.save();
};

/**
 * Get allowed pages (for frontend filtering)
 */
WidgetConfigSchema.methods.isPageAllowed = function(pathname) {
  // If excludedPages contains path, always hide
  if (this.behavior?.excludedPages?.some(pattern => this._matchPattern(pathname, pattern))) {
    return false;
  }

  // Check allowedPages (default is ['*'] which means all)
  const allowed = this.behavior?.allowedPages || ['*'];
  return allowed.some(pattern => this._matchPattern(pathname, pattern));
};

/**
 * Simple glob pattern matching
 */
WidgetConfigSchema.methods._matchPattern = function(pathname, pattern) {
  if (pattern === '*') return true;
  if (pattern === pathname) return true;
  
  // Convert glob to regex (* = .*, ? = .)
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex chars
    .replace(/\*/g, '.*') // * matches anything
    .replace(/\?/g, '.'); // ? matches single char
  
  return new RegExp(`^${regexPattern}$`).test(pathname);
};

module.exports = mongoose.model('WidgetConfig', WidgetConfigSchema);
