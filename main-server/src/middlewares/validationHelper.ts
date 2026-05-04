/**
 * Validation Middleware & Helpers
 * Centralized input validation for all endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { BadRequestError } from '../utils/errors';

/**
 * Validate request and return errors
 */
export const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((error: any) => ({
        field: error.param || error.path,
        message: error.msg,
        value: error.value
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: formattedErrors
      });
    }
    next();
  };
};

/**
 * Common validation chains
 */
export const validateContact = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('any')
    .withMessage('Invalid phone number format'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

export const validateMessage = [
  body('body')
    .optional()
    .trim()
    .isLength({ max: 4096 })
    .withMessage('Message must be less than 4096 characters'),
  body('type')
    .optional()
    .isIn(['text', 'image', 'video', 'audio', 'document', 'template', 'interactive'])
    .withMessage('Invalid message type'),
  body('templateName')
    .optional()
    .isString()
    .withMessage('Template name must be a string'),
  body('isInternalNote')
    .optional()
    .isBoolean()
    .withMessage('isInternalNote must be boolean')
];

export const validateCampaign = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be 3-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('template')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID'),
  body('segment')
    .optional()
    .isArray()
    .withMessage('Segment must be an array'),
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
];

export const validateAutomation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Automation name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be 3-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }),
  body('triggers')
    .isArray()
    .withMessage('Triggers must be an array')
    .notEmpty()
    .withMessage('At least one trigger is required'),
  body('actions')
    .isArray()
    .withMessage('Actions must be an array')
    .notEmpty()
    .withMessage('At least one action is required'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be boolean')
];

export const validateDeal = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Deal title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be 3-200 characters'),
  body('value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Value must be a positive number'),
  body('pipeline')
    .optional()
    .isMongoId()
    .withMessage('Invalid pipeline ID'),
  body('stage')
    .optional()
    .isString()
    .withMessage('Stage must be a string'),
  body('contact')
    .optional()
    .isMongoId()
    .withMessage('Invalid contact ID'),
  body('expectedCloseDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('probability')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Probability must be 0-100')
];

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100'),
  query('sort')
    .optional()
    .isString()
    .withMessage('Sort must be a string'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search must be less than 200 characters')
];

export const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

export const validateEmail = [
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
];

export const validatePassword = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain number')
];

export const validateWorkspaceSettings = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be 3-100 characters'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi'])
    .withMessage('Unsupported language'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object')
];

/**
 * Sanitize output - remove sensitive fields
 */
export function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user.toObject ? user.toObject() : user;
  return safe;
}

export function sanitizeWorkspace(workspace: any) {
  const { bspAppSecret, whatsappAccessToken, ...safe } = workspace.toObject ? workspace.toObject() : workspace;
  return safe;
}

/**
 * Check for malicious input
 */
export function isSafeInput(value: any): boolean {
  if (typeof value === 'string') {
    // Check for common injection patterns
    const dangerous = /<script|javascript:|onerror|onclick|<iframe/gi;
    return !dangerous.test(value);
  }
  return true;
}

/**
 * Validate file upload
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'No file provided'
    });
  }

  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (!allowedMimes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: 'File type not allowed'
    });
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    return res.status(400).json({
      success: false,
      error: 'File size exceeds 10MB limit'
    });
  }

  next();
};
