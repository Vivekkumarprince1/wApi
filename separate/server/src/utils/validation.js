/**
 * VALIDATION UTILITIES
 * Centralized input validation helpers
 */

const { body, param, query, validationResult } = require('express-validator');
const { createError, ERROR_CODES } = require('./errorFormatter');

/**
 * Handle validation results
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().reduce((acc, error) => {
      acc[error.param] = error.msg;
      return acc;
    }, {});

    const error = createError(
      ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
      validationErrors,
      422
    );
    return next(error);
  }
  next();
}

/**
 * Common validation rules
 */
const validationRules = {
  // ID validation
  objectId: (field) => param(field).isMongoId().withMessage(`${field} must be a valid ID`),

  // String validations
  requiredString: (field, maxLength = 255) =>
    body(field)
      .trim()
      .isLength({ min: 1, max: maxLength })
      .withMessage(`${field} is required and must be between 1-${maxLength} characters`),

  optionalString: (field, maxLength = 255) =>
    body(field)
      .optional()
      .trim()
      .isLength({ max: maxLength })
      .withMessage(`${field} must be less than ${maxLength} characters`),

  // Email validation
  email: (field) =>
    body(field)
      .isEmail()
      .normalizeEmail()
      .withMessage(`${field} must be a valid email address`),

  // Phone validation (basic)
  phone: (field) =>
    body(field)
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage(`${field} must be a valid phone number`),

  // URL validation
  url: (field) =>
    body(field)
      .optional()
      .isURL()
      .withMessage(`${field} must be a valid URL`),

  // Number validations
  positiveInteger: (field) =>
    body(field)
      .isInt({ min: 1 })
      .withMessage(`${field} must be a positive integer`),

  optionalPositiveInteger: (field) =>
    body(field)
      .optional()
      .isInt({ min: 0 })
      .withMessage(`${field} must be a non-negative integer`),

  // Array validations
  arrayOfStrings: (field, maxItems = 10) =>
    body(field)
      .optional()
      .isArray({ max: maxItems })
      .withMessage(`${field} must be an array with max ${maxItems} items`)
      .custom((value) => {
        if (!value.every(item => typeof item === 'string' && item.trim().length > 0)) {
          throw new Error(`${field} must contain only non-empty strings`);
        }
        return true;
      }),

  // Boolean validation
  boolean: (field) =>
    body(field)
      .isBoolean()
      .withMessage(`${field} must be a boolean`),

  optionalBoolean: (field) =>
    body(field)
      .optional()
      .isBoolean()
      .withMessage(`${field} must be a boolean`),

  // Date validation
  isoDate: (field) =>
    body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} must be a valid ISO date`),

  // Enum validation
  enum: (field, allowedValues) =>
    body(field)
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`),

  optionalEnum: (field, allowedValues) =>
    body(field)
      .optional()
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`),

  // Pagination
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

/**
 * Contact-specific validations
 */
const contactValidations = {
  create: [
    validationRules.requiredString('phone'),
    validationRules.optionalString('name'),
    validationRules.arrayOfStrings('tags', 10),
    validationRules.email('metadata.email').optional(),
    validationRules.optionalString('metadata.firstName'),
    validationRules.optionalString('metadata.lastName')
  ],

  update: [
    validationRules.optionalString('name'),
    validationRules.arrayOfStrings('tags', 10),
    validationRules.email('metadata.email').optional(),
    validationRules.optionalString('metadata.firstName'),
    validationRules.optionalString('metadata.lastName')
  ]
};

/**
 * Template-specific validations
 */
const templateValidations = {
  create: [
    validationRules.requiredString('name'),
    validationRules.enum('category', ['MARKETING', 'UTILITY', 'AUTHENTICATION']),
    validationRules.requiredString('language'),
    body('components').isArray({ min: 1 }).withMessage('At least one component is required'),
    body('components.*.type').isIn(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']).withMessage('Invalid component type')
  ]
};

/**
 * Campaign-specific validations
 */
const campaignValidations = {
  create: [
    validationRules.requiredString('name'),
    validationRules.objectId('templateId'),
    body('contactIds').isArray({ min: 1, max: 10000 }).withMessage('Contact IDs array required (1-10000 items)'),
    body('contactIds.*').isMongoId().withMessage('Invalid contact ID'),
    validationRules.optionalBoolean('scheduled'),
    validationRules.isoDate('scheduledAt').optional()
  ]
};

module.exports = {
  handleValidationErrors,
  validationRules,
  contactValidations,
  templateValidations,
  campaignValidations
};