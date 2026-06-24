import "server-only";

/**
 * Registry of platform services for the Monitoring Center. URLs are overridable
 * via env so the same code works in dev (localhost) and prod (internal DNS).
 */
export interface ServiceDef {
  id: string;
  name: string;
  baseUrl: string;
  /** Health endpoint path that returns 200 when the service is up. */
  healthPath: string;
  requiresInternalSecret?: boolean;
}

const CORE_GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5001";

export const SERVICES: ServiceDef[] = [
  { id: "core", name: "Core Gateway", baseUrl: CORE_GATEWAY_URL, healthPath: "/ready" },
  { id: "billing", name: "Billing Service", baseUrl: `${CORE_GATEWAY_URL}/api/admin/billing`, healthPath: "/ready", requiresInternalSecret: true },
  { id: "campaign", name: "Campaign Service", baseUrl: `${CORE_GATEWAY_URL}/api/admin/campaign`, healthPath: "/ready", requiresInternalSecret: true },
  { id: "automation", name: "Automation Service", baseUrl: `${CORE_GATEWAY_URL}/api/admin/automation`, healthPath: "/ready", requiresInternalSecret: true },
  { id: "socket", name: "Socket.IO on Core", baseUrl: CORE_GATEWAY_URL, healthPath: "/ready" },
];
