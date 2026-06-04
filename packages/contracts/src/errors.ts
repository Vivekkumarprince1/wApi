export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: any;

  constructor(statusCode: number, message: string, errorCode: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function formatErrorResponse(err: any) {
  if (err instanceof ApiError) {
    return {
      success: false,
      error: {
        message: err.message,
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        details: err.details,
      },
    };
  }

  return {
    success: false,
    error: {
      message: err.message || 'An unexpected error occurred',
      errorCode: err.errorCode || 'INTERNAL_ERROR',
      statusCode: err.statusCode || err.status || 500,
      details: err.details || null,
    },
  };
}
