export function ok<T>(data: T, message?: string) {
  return { success: true as const, data, message };
}

export function fail(error: string, errorCode?: string, details?: unknown) {
  return { success: false as const, error, errorCode, details };
}
