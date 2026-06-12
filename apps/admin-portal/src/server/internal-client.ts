import "server-only";
import axios from "axios";
import jwt from "jsonwebtoken";

/**
 * Direct service-to-service client (NOT the gateway).
 *
 * Used by the self-contained portal to reach service-internal endpoints that
 * the services themselves call internally — e.g. the cross-service workspace
 * purge routes (`/internal/purge/:workspaceId`) guarded by the internal
 * service secret. This is exactly how core-server's AccountDeletionService
 * reaches the other services, so we replicate it rather than route through the
 * gateway.
 */

const URLS = {
  automation: process.env.AUTOMATION_SERVICE_URL || "http://localhost:3001",
  campaign: process.env.CAMPAIGN_SERVICE_URL || "http://localhost:3002",
  billing: process.env.BILLING_SERVICE_URL || "http://localhost:3003",
  bsp: process.env.BSP_SERVICE_URL || "http://localhost:3004",
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:3006",
  contact: process.env.CONTACT_SERVICE_URL || "http://localhost:3007",
  chat: process.env.CHAT_SERVICE_URL || "http://localhost:3008",
  websocket: process.env.WEBSOCKET_SERVICE_URL || "http://localhost:3009",
  ingestor: process.env.WEBHOOK_INGESTOR_URL || "http://localhost:3013",
} as const;

type ServiceId = keyof typeof URLS;

function internalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) throw new Error("[admin-portal/internal] INTERNAL_SERVICE_SECRET is not set");
  return { "x-internal-service-secret": secret };
}

/** DELETE a service-internal path. Returns true on 2xx, false otherwise. */
export async function internalDelete(service: ServiceId, path: string): Promise<boolean> {
  try {
    const res = await axios.delete(`${URLS[service]}${path}`, {
      headers: internalHeaders(),
      timeout: 10000,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      console.warn(`[admin-portal/internal] ${service} ${path} returned ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    // Match core-server behaviour: log but don't throw, so a downed service
    // doesn't block the rest of a destructive operation.
    console.error(`[admin-portal/internal] ${service} ${path} unreachable:`, (err as Error).message);
    return false;
  }
}

/** POST a service-internal path. Returns { ok, status, data }. */
export async function internalPost(
  service: ServiceId,
  path: string,
  body: unknown = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await axios.post(`${URLS[service]}${path}`, body, {
      headers: { ...internalHeaders(), "x-internal-service": "admin-portal", "Content-Type": "application/json" },
      timeout: 15000,
      validateStatus: () => true,
    });
    return { ok: res.status < 400, status: res.status, data: res.data };
  } catch (err) {
    console.error(`[admin-portal/internal] ${service} ${path} unreachable:`, (err as Error).message);
    return { ok: false, status: 502, data: null };
  }
}

/**
 * Mint an impersonation auth_token identical to core-server's `signToken`
 * (same secret, same payload shape, role=owner, isImpersonating=true). The
 * customer portal accepts it natively.
 */
export function signImpersonationToken(params: {
  targetUserId: string;
  adminId: string;
  workspaceId: string;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[admin-portal/internal] JWT_SECRET is not set");
  const ttl = (process.env.AUTH_TOKEN_TTL || "7d") as jwt.SignOptions["expiresIn"];
  return jwt.sign(
    {
      id: params.targetUserId,
      adminId: params.adminId,
      isImpersonating: true,
      workspaceId: params.workspaceId,
      role: "owner",
    },
    secret,
    { expiresIn: ttl }
  );
}
