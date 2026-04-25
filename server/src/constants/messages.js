/**
 * STANDARD MESSAGES
 * Centralized message definitions for consistent API responses
 */

const SUCCESS_MESSAGES = {
  // Generic
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  RETRIEVED: 'Resource retrieved successfully',

  // Authentication
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_RESET: 'Password reset successful',
  EMAIL_VERIFIED: 'Email verified successfully',

  // Messaging
  MESSAGE_SENT: 'Message sent successfully',
  TEMPLATE_CREATED: 'Template created successfully',
  CAMPAIGN_STARTED: 'Campaign started successfully',
  CONTACT_CREATED: 'Contact created successfully',

  // Commerce
  ORDER_PLACED: 'Order placed successfully',
  PAYMENT_PROCESSED: 'Payment processed successfully',

  // Automation
  RULE_CREATED: 'Automation rule created successfully',
  RULE_EXECUTED: 'Automation rule executed successfully'
};

const INFO_MESSAGES = {
  // Processing
  PROCESSING: 'Request is being processed',
  QUEUED: 'Request has been queued for processing',

  // Status
  PENDING: 'Request is pending',
  IN_PROGRESS: 'Operation in progress',

  // Notifications
  NOTIFICATION_SENT: 'Notification sent',
  ALERT_TRIGGERED: 'Alert triggered'
};

const WARNING_MESSAGES = {
  // Limits
  APPROACHING_LIMIT: 'Approaching usage limit',
  RATE_LIMIT_WARNING: 'Rate limit warning',

  // Deprecation
  DEPRECATED_API: 'This API endpoint is deprecated',
  LEGACY_FEATURE: 'This feature is legacy and may be removed',

  // Validation
  INVALID_INPUT: 'Invalid input provided',
  RECOMMENDED_CHANGES: 'Recommended changes detected'
};

module.exports = {
  SUCCESS_MESSAGES,
  INFO_MESSAGES,
  WARNING_MESSAGES
};