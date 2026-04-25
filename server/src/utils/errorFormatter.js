/**
 * ERROR FORMATTER
 * Consistent error response formatting across the API
 */

const { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } = require('../constants/errors');
const logger = require('./logger');

/**
 * Format error for API response
 */
function formatError(error, includeStack = false) {
  const errorResponse = {
    success: false,
    error: {
      code: error.code || ERROR_CODES.INTERNAL_ERROR,
      message: error.message || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
      timestamp: new Date().toISOString()
    }
  };

  // Include stack trace in development or when explicitly requested
  if ((process.env.NODE_ENV === 'development' || includeStack) && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // Include additional error details if available
  if (error.details) {
    errorResponse.error.details = error.details;
  }

  // Include validation errors if available
  if (error.errors) {
    errorResponse.error.validation = error.errors;
  }

  return errorResponse;
}

/**
 * Create standardized error object
 */
function createError(code, message = null, details = null, statusCode = null) {
  const error = new Error(message || ERROR_MESSAGES[code] || 'An error occurred');
  error.code = code;
  error.statusCode = statusCode || getStatusCodeForError(code);

  if (details) {
    error.details = details;
  }

  // Log the error
  logger.error(error.message, {
    code: error.code,
    statusCode: error.statusCode,
    details: error.details,
    stack: error.stack
  });

  return error;
}

/**
 * Get appropriate HTTP status code for error code
 */
function getStatusCodeForError(code) {
  const statusMap = {
    [ERROR_CODES.UNAUTHORIZED]: HTTP_STATUS.UNAUTHORIZED,
    [ERROR_CODES.FORBIDDEN]: HTTP_STATUS.FORBIDDEN,
    [ERROR_CODES.NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
    [ERROR_CODES.VALIDATION_ERROR]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    [ERROR_CODES.ALREADY_EXISTS]: HTTP_STATUS.CONFLICT,
    [ERROR_CODES.LIMIT_EXCEEDED]: HTTP_STATUS.TOO_MANY_REQUESTS,
    [ERROR_CODES.REQUIRED_FIELD]: HTTP_STATUS.BAD_REQUEST,
    [ERROR_CODES.INVALID_FORMAT]: HTTP_STATUS.BAD_REQUEST,
    [ERROR_CODES.INVALID_CREDENTIALS]: HTTP_STATUS.UNAUTHORIZED,
    [ERROR_CODES.TOKEN_EXPIRED]: HTTP_STATUS.UNAUTHORIZED
  };

  return statusMap[code] || HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

/**
 * Handle async route errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.apiError(
    req.method,
    req.url,
    err.statusCode || 500,
    err,
    req.user?.id,
    req.user?.workspace
  );

  // Don't expose internal errors in production
  const includeStack = process.env.NODE_ENV === 'development';

  // Format error response
  const errorResponse = formatError(err, includeStack);

  // Send response
  res.status(err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
}

/**
 * Validation error formatter for express-validator
 */
function formatValidationErrors(errors) {
  return errors.array().reduce((acc, error) => {
    acc[error.param] = error.msg;
    return acc;
  }, {});
}

module.exports = {
  formatError,
  createError,
  getStatusCodeForError,
  asyncHandler,
  errorHandler,
  formatValidationErrors,
  ERROR_CODES,
  ERROR_MESSAGES,
  HTTP_STATUS
};