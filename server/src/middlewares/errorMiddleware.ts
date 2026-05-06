import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';

/**
 * Global Error Handler Middleware
 */
export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${req.method} ${req.url}:`, err);

  // Default error
  let statusCode = 500;
  let message = 'An unexpected error occurred';
  let code = 'INTERNAL_ERROR';
  let details = undefined;

  // Handle specific error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Data validation failed';
    code = 'DATABASE_VALIDATION_ERROR';
    details = Object.values(err.errors).map((e: any) => ({
      field: e.path,
      message: e.message
    }));
  } else if (err.name === 'MongoServerError' && err.code === 11000) {
    // Duplicate key error
    statusCode = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_KEY_ERROR';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
};
