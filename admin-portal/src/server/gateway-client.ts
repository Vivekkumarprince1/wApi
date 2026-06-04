import "server-only";
import type { AdminTokenPayload } from "./auth";

/**
 * Gateway client for WRITE operations (Rule #5).
 *
 * The admin portal never mutates MongoDB directly. All state changes are
 * delegated to the API Gateway, which routes to the owning service so that
 * domain events, BullMQ jobs, cache invalidation and audit logs all fire.
 *
 * Requests carry the internal service secret plus the acting admin's identity
 * via the gateway's trusted-header convention (x-user-id / x-user-role), so
 * downstream services treat them as authenticated super-admin actions.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5001";

function getInternalSecret(): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) throw new Error("[admin-portal/gateway] INTERNAL_SERVICE_SECRET is not set");
  return secret;
}

export interface GatewayResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  /** Raw Set-Cookie header(s) returned by the upstream, if any. */
  setCookie?: string | null;
}

interface GatewayCallOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON body for write requests. */
  body?: unknown;
  /** The acting admin — identity is forwarded to downstream services. */
  actor: AdminTokenPayload;
  /** Optional workspace context (e.g. for impersonation / scoped ops). */
  workspaceId?: string;
}

/**
 * Calls a gateway path under /api/v1/* on behalf of an admin. `path` should be
 * the gateway-relative path, e.g. "super-admin/workspaces/123/impersonate".
 */
export async function gatewayCall<T = unknown>(
  path: string,
  options: GatewayCallOptions
): Promise<GatewayResult<T>> {
  const { method = "POST", body, actor, workspaceId } = options;
  const url = `${GATEWAY_URL}/api/v1/${path.replace(/^\/+/, "")}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-internal-service-secret": getInternalSecret(),
    "x-user-id": actor.userId,
    "x-user-role": actor.role,
    "x-workspace-id": workspaceId || "",
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = null;
    }

    const setCookie = res.headers.get("set-cookie");

    if (!res.ok) {
      const error =
        (data && typeof data === "object" && "message" in data
          ? String((data as Record<string, unknown>).message)
          : undefined) || `Gateway returned ${res.status}`;
      return { ok: false, status: res.status, data, error, setCookie };
    }

    return { ok: true, status: res.status, data, setCookie };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      data: null,
      error: err instanceof Error ? err.message : "Gateway request failed",
    };
  }
}
