/**
 * Error Handling Middleware
 * Standardized error responses and logging
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError, ValidationError, NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../utils/errors';
import { ActivityLog } from '../models';

/**
 * Centralized error handler middleware
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[Error Handler] ${err.name || 'Error'}:`, err.message);

  // Extract context from request
  const workspaceId = (req as any).workspace?._id;
  const userId = (req as any).user?._id;
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const method = req.method;
  const path = req.path;

  // Log error activity if we have workspace and user context
  if (workspaceId && userId) {
    ActivityLog.create({
      workspace: workspaceId,
      user: userId,
      action: 'error',
      entityType: 'api_error',
      status: 'failed',
      errorDetails: `${err.name}: ${err.message}`,
      ipAddress: ip,
      metadata: {
        method,
        path,
        statusCode: err.statusCode || 500,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    }).catch(logErr => console.error('[ActivityLog] Error logging failed:', logErr.message));
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      errorCode: err.code,
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Handle specific error types
  if (err instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      error: err.message,
      errorCode: 'NOT_FOUND'
    });
  }

  if (err instanceof ForbiddenError) {
    return res.status(403).json({
      success: false,
      error: err.message,
      errorCode: 'FORBIDDEN'
    });
  }

  if (err instanceof ConflictError) {
    return res.status(409).json({
      success: false,
      error: err.message,
      errorCode: 'CONFLICT',
      ...(err.details && { details: err.details })
    });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: err.message,
      errorCode: 'VALIDATION_ERROR',
      errors: err.details
    });
  }

  if (err instanceof BadRequestError) {
    return res.status(400).json({
      success: false,
      error: err.message,
      errorCode: 'BAD_REQUEST'
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError' && err.errors) {
    const formattedErrors = Object.entries(err.errors).map(([field, error]: any) => ({
      field,
      message: error.message
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      errors: formattedErrors
    });
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      errorCode: 'INVALID_ID'
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: `${field} already exists`,
      errorCode: 'DUPLICATE_ENTRY',
      field
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      errorCode: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      errorCode: 'TOKEN_EXPIRED'
    });
  }

  // Default error response
  return res.status(err.statusCode || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : err.message,
    errorCode: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err
    })
  });
};

/**
 * Wrapper for async route handlers to catch errors
 */
export const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    errorCode: 'NOT_FOUND',
    path: req.path
  });
};

/**
 * Request validation error formatter
 */
export const validationErrorFormatter = (errors: any[]) => {
  return errors.map(error => ({
    field: error.param,
    value: error.value,
    message: error.msg,
    location: error.location
  }));
};
