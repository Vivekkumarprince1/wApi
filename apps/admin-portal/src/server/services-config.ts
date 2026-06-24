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

const firstEnv = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value.replace(/\/+$/, "");
  }
  return undefined;
};

const gatewayUrl = firstEnv("GATEWAY_URL", "API_GATEWAY_URL") || "http://localhost:5001";

const throughGateway = (
  id: string,
  name: string,
  healthService: string,
  tier: ServiceDef["tier"] = "backend"
): ServiceDef => ({
  id,
  name,
  baseUrl: gatewayUrl,
  healthPath: `/api/internal/health/${healthService}`,
  tier,
});

const directOrGateway = (
  id: string,
  name: string,
  healthService: string,
  envNames: string[]
): ServiceDef => {
  const directUrl = firstEnv(...envNames);
  if (directUrl) {
    return { id, name, baseUrl: directUrl, healthPath: "/health", tier: "backend" };
  }
  return throughGateway(id, name, healthService);
};

export const SERVICES: ServiceDef[] = [
  { id: "gateway", name: "API Gateway", baseUrl: gatewayUrl, healthPath: "/health", tier: "edge" },
  directOrGateway("auth", "Auth Service", "auth", ["AUTH_SERVICE_URL"]),
  directOrGateway("chat", "Chat Service", "chat", ["CHAT_SERVICE_URL"]),
  directOrGateway("contact", "Contact Service", "contact", ["CONTACT_SERVICE_URL"]),
  directOrGateway("billing", "Billing Service", "billing", ["BILLING_SERVICE_URL"]),
  directOrGateway("campaign", "Campaign Service", "campaign", ["CAMPAIGN_SERVICE_URL"]),
  directOrGateway("automation", "Automation Service", "automation", ["AUTOMATION_SERVICE_URL"]),
  directOrGateway("bsp", "BSP / Service Provider", "serviceProvider", ["SERVICE_PROVIDER_URL", "BSP_SERVICE_URL"]),
  directOrGateway("ingestor", "Webhook Ingestor", "ingestor", ["WEBHOOK_INGESTOR_URL"]),
  directOrGateway("websocket", "WebSocket Gateway", "websocket", ["WEBSOCKET_URL"]),
  {
    id: "customer-portal",
    name: "Customer Portal (frontend)",
    baseUrl: firstEnv("CUSTOMER_PORTAL_URL") || "http://localhost:3000",
    healthPath: "/",
    tier: "frontend",
  },
];
