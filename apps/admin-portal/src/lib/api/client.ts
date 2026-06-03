"use client";

/**
 * Thin fetch wrapper for admin BFF calls. All requests hit the local
 * /api/admin/* route handlers (never the gateway directly from the client).
 */

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  return parse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body });
}

/** Generic mutation helper for POST/PATCH/PUT/DELETE. */
export async function apiFetch<T>(
  path: string,
  opts: { method: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown }
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method,
    headers: { "Content-Type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return parse<T>(res);
}
