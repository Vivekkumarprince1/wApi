/**
 * SERVICES INDEX
 * Centralized exports for all services
 */

// Messaging services
const contactService = require('./messaging/contactService');

// Auth services
const authService = require('./auth/authService');
const tokenService = require('./auth/tokenService');
const otpService = require('./auth/otpService');

// BSP services
const gupshupService = require('./bsp/gupshupService');
const bspMessagingService = require('./bsp/bspMessagingService');
const MessageBuilder = require('./whatsapp/messageBuilder');

// Workspace services
const workspaceService = require('./workspace/workspaceService');
const billingService = require('./workspace/billingService');

// Analytics services
const analyticsService = require('./analytics/analyticsService');

// Integration services
const instagramService = require('./integration/instagramService');
const facebookService = require('./integration/facebookService');

// Admin services
const auditService = require('./admin/auditService');

module.exports = {
  // Messaging
  contactService,

  // Auth
  authService,
  tokenService,
  otpService,

  // BSP
  gupshupService,
  bspMessagingService,
  MessageBuilder,

  // Workspace
  workspaceService,
  billingService,

  // Analytics
  analyticsService,

  // Integration
  instagramService,
  facebookService,

  // Admin
  auditService
};