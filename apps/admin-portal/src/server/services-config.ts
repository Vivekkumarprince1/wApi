import "server-only";
import { config } from "@/config/env";

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

const gatewayUrl = config.gatewayUrl;

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
  const directUrl = envNames
    .map((name) => serviceUrlFromEnvName(name))
    .find(Boolean);
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
    baseUrl: config.services.customerPortal,
    healthPath: "/",
    tier: "frontend",
  },
];

function serviceUrlFromEnvName(name: string): string | undefined {
  const urls: Record<string, string | undefined> = {
    AUTH_SERVICE_URL: config.services.auth,
    CHAT_SERVICE_URL: config.services.chat,
    CONTACT_SERVICE_URL: config.services.contact,
    BILLING_SERVICE_URL: config.services.billing,
    CAMPAIGN_SERVICE_URL: config.services.campaign,
    AUTOMATION_SERVICE_URL: config.services.automation,
    SERVICE_PROVIDER_URL: config.services.serviceProvider,
    BSP_SERVICE_URL: config.services.serviceProvider,
    WEBHOOK_INGESTOR_URL: config.services.webhookIngestor,
    WEBSOCKET_URL: config.services.websocket,
  };
  return urls[name];
}
