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

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5001";

// Using a type representing the original services for backward compatibility
type ServiceId = "automation" | "campaign" | "billing" | "bsp" | "auth" | "contact" | "chat" | "websocket" | "ingestor";

const gatewayServiceSegment: Record<ServiceId, string> = {
  automation: "automation",
  campaign: "campaign",
  billing: "billing",
  bsp: "provider",
  auth: "auth",
  contact: "contacts",
  chat: "chat",
  websocket: "websocket",
  ingestor: "ingestor",
};

const directServiceBase: Partial<Record<ServiceId, string>> = {
  bsp: process.env.SERVICE_PROVIDER_URL || process.env.BSP_SERVICE_URL,
};

function internalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) throw new Error("[admin-portal/internal] INTERNAL_SERVICE_SECRET is not set");
  return { "x-internal-service-secret": secret };
}

function internalUrl(service: ServiceId, path: string): string {
  const directBase = directServiceBase[service]?.replace(/\/+$/, "");
  if (directBase) {
    if (service === "bsp") return `${directBase}/internal/v1/bsp${path}`;
    return `${directBase}${path}`;
  }

  return `${GATEWAY_URL}/api/internal/${gatewayServiceSegment[service]}${path}`;
}

/** DELETE a service-internal path. Returns true on 2xx, false otherwise. */
export async function internalDelete(service: ServiceId, path: string): Promise<boolean> {
  try {
    const res = await axios.delete(internalUrl(service, path), {
      headers: { ...internalHeaders(), "x-internal-service": "admin-portal" },
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
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  try {
    const res = await axios.post(internalUrl(service, path), body, {
      headers: { ...internalHeaders(), "x-internal-service": "admin-portal", "Content-Type": "application/json" },
      timeout: 15000,
      validateStatus: () => true,
    });
    return {
      ok: res.status < 400,
      status: res.status,
      data: res.data,
      error: res.status >= 400 ? responseMessage(res.data) || `Internal service returned ${res.status}` : undefined,
    };
  } catch (err) {
    console.error(`[admin-portal/internal] ${service} ${path} unreachable:`, (err as Error).message);
    return { ok: false, status: 502, data: null, error: (err as Error).message };
  }
}

/** DELETE a service-internal path. Returns { ok, status, data }. */
export async function internalDeleteJson(
  service: ServiceId,
  path: string
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  try {
    const res = await axios.delete(internalUrl(service, path), {
      headers: { ...internalHeaders(), "x-internal-service": "admin-portal" },
      timeout: 15000,
      validateStatus: () => true,
    });
    return {
      ok: res.status < 400,
      status: res.status,
      data: res.data,
      error: res.status >= 400 ? responseMessage(res.data) || `Internal service returned ${res.status}` : undefined,
    };
  } catch (err) {
    console.error(`[admin-portal/internal] ${service} ${path} unreachable:`, (err as Error).message);
    return { ok: false, status: 502, data: null, error: (err as Error).message };
  }
}

function responseMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return typeof record.message === "string"
    ? record.message
    : typeof record.error === "string"
      ? record.error
      : undefined;
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
