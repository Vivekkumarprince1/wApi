/** Mongo ObjectId — always serialised as a 24-char hex string on the wire. */
export type ObjectIdString = string;
/** Standard envelope used by most monolith REST handlers. */
export interface ApiSuccess<T = unknown> {
    success: true;
    data?: T;
    message?: string;
}
export interface ApiError {
    success: false;
    error: string;
    errorCode?: string;
    details?: unknown;
}
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
export interface PaginationInfo {
    total: number;
    page: number;
    limit: number;
    hasMore?: boolean;
    pages?: number;
}
//# sourceMappingURL=common.d.ts.map