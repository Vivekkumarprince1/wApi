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
}

export const SERVICES: ServiceDef[] = [
  { id: "gateway", name: "API Gateway", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/ready" },
  { id: "core", name: "Core Server", baseUrl: process.env.CORE_SERVER_URL || "http://localhost:5005", healthPath: "/health" },
  { id: "billing", name: "Billing Service", baseUrl: process.env.BILLING_SERVICE_URL || "http://localhost:3003", healthPath: "/health" },
  { id: "campaign", name: "Campaign Service", baseUrl: process.env.CAMPAIGN_SERVICE_URL || "http://localhost:3002", healthPath: "/health" },
  { id: "automation", name: "Automation Service", baseUrl: process.env.AUTOMATION_SERVICE_URL || "http://localhost:3001", healthPath: "/health" },
  { id: "websocket", name: "WebSocket Service", baseUrl: process.env.WEBSOCKET_SERVICE_URL || "http://localhost:4000", healthPath: "/live" },
];
