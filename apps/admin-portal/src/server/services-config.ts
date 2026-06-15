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
  { id: "auth", name: "Auth Service", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/auth", tier: "backend" },
  { id: "chat", name: "Chat Service", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/chat", tier: "backend" },
  { id: "contact", name: "Contact Service", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/contact", tier: "backend" },
  { id: "billing", name: "Billing Service", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/billing", tier: "backend" },
  { id: "campaign", name: "Campaign Service", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/campaign", tier: "backend" },
  { id: "automation", name: "Automation Service", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/automation", tier: "backend" },
  { id: "bsp", name: "BSP / Service Provider", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/serviceProvider", tier: "backend" },
  { id: "ingestor", name: "Webhook Ingestor", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/ingestor", tier: "backend" },
  { id: "websocket", name: "WebSocket Gateway", baseUrl: process.env.GATEWAY_URL || "http://localhost:5001", healthPath: "/api/internal/health/websocket", tier: "backend" },
  { id: "customer-portal", name: "Customer Portal (frontend)", baseUrl: process.env.CUSTOMER_PORTAL_URL || "http://localhost:3000", healthPath: "/", tier: "frontend" },
];
