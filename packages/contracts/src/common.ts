/** Mongo ObjectId — always serialised as a 24-char hex string on the wire. */
export type ObjectIdString = string;

/** Standard envelope used by most monolith REST handlers. */
export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    errorCode: string;
    statusCode: number;
    details?: any;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiErrorResponse;

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  hasMore?: boolean;
  pages?: number;
}
