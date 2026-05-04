/**
 * Standardized API Errors
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(400, message, 'BAD_REQUEST');
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(401, message, 'AUTH_ERROR', details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access denied: Insufficient permissions', details?: any) {
    super(403, message, 'PERMISSION_DENIED', details);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(404, message, 'NOT_FOUND', details);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = 'Resource already exists', details?: any) {
    super(409, message, 'CONFLICT', details);
  }
}
