import "server-only";

/**
 * Registry of platform services for the Monitoring Center. URLs are overridable
 * via env so the same code works in dev (localhost) and prod (internal DNS).
 *
 * Covers EVERY deployable: the API gateway, all nine backend microservices,
 * and the customer-portal frontend — so the super admin sees the entire
 * platform's connections in one place.
 */
export interface ServiceDef {
  id: string;
  name: string;
  baseUrl: string;
  /** Health endpoint path that returns 200 when the service is up. */
  healthPath: string;
  /** Logical tier shown in the UI. */
  tier: "edge" | "backend" | "frontend";
}

export const SERVICES: ServiceDef[] = [
  { id: "gateway", name: "API Gateway", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/health", tier: "edge" },
  { id: "auth", name: "Auth Service", baseUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3006", healthPath: "/health", tier: "backend" },
  { id: "chat", name: "Chat Service", baseUrl: process.env.CHAT_SERVICE_URL || "http://localhost:3008", healthPath: "/health", tier: "backend" },
  { id: "contact", name: "Contact Service", baseUrl: process.env.CONTACT_SERVICE_URL || "http://localhost:3007", healthPath: "/health", tier: "backend" },
  { id: "billing", name: "Billing Service", baseUrl: process.env.BILLING_SERVICE_URL || "http://localhost:3003", healthPath: "/health", tier: "backend" },
  { id: "campaign", name: "Campaign Service", baseUrl: process.env.CAMPAIGN_SERVICE_URL || "http://localhost:3002", healthPath: "/health", tier: "backend" },
  { id: "automation", name: "Automation Service", baseUrl: process.env.AUTOMATION_SERVICE_URL || "http://localhost:3001", healthPath: "/health", tier: "backend" },
  { id: "bsp", name: "BSP / Service Provider", baseUrl: process.env.BSP_SERVICE_URL || "http://localhost:3004", healthPath: "/health", tier: "backend" },
  { id: "ingestor", name: "Webhook Ingestor", baseUrl: process.env.WEBHOOK_INGESTOR_URL || "http://localhost:3013", healthPath: "/health", tier: "backend" },
  { id: "websocket", name: "WebSocket Gateway", baseUrl: process.env.WEBSOCKET_SERVICE_URL || "http://localhost:3009", healthPath: "/health", tier: "backend" },
  { id: "customer-portal", name: "Customer Portal (frontend)", baseUrl: process.env.CUSTOMER_PORTAL_URL || "http://localhost:3000", healthPath: "/", tier: "frontend" },
];
