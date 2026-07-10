/**
 * Billing-service OpenAPI document.
 *
 * Mounted from `src/index.ts` via `mountSwaggerUI(app, openapiDocument)`.
 * Reachable at `http://localhost:3003/docs`.
 */

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { buildOpenApiDocument } from '@connectsphere/contracts';

export const registry = new OpenAPIRegistry();

const generator = new OpenApiGeneratorV3(registry.definitions);
const generated = generator.generateComponents() as Record<string, any>;

export const openapiDocument = buildOpenApiDocument({
  info: {
    title: 'ConnectSphere — Billing Service',
    version: '1.0.0',
    description:
      'Wallet management, Razorpay payments, commerce orders, and the billing ' +
      'saga (budget park / settle) consumed by campaign-service.',
    servers: [{ url: 'http://localhost:3003', description: 'Local dev' }],
  },
  generated,
  manual: {
    tags: [
      { name: 'Wallets', description: 'Wallet balance, top-up, transactions' },
      { name: 'Commerce', description: 'Order placement and management' },
      { name: 'Webhooks', description: 'Razorpay webhook ingestion' },
      { name: 'Health', description: 'Liveness / readiness probes' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Service health check',
          responses: { '200': { description: 'Healthy' } },
        },
      },
      '/api/billing/wallets/{workspaceId}/balance': {
        get: {
          tags: ['Wallets'],
          summary: 'Get current wallet balance for a workspace',
          security: [{ bearerAuth: [] }, { internalServiceSecret: [] }],
          parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Wallet balance' } },
        },
      },
      '/api/billing/wallets/{workspaceId}/topup': {
        post: {
          tags: ['Wallets'],
          summary: 'Create a Razorpay order to top up the wallet',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'workspaceId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: { type: 'integer', description: 'Top-up amount in paise/cents' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Razorpay order created' } },
        },
      },
      '/api/billing/webhooks/razorpay': {
        post: {
          tags: ['Webhooks'],
          summary: 'Razorpay webhook ingestion',
          description: 'Verifies signature using RAZORPAY_WEBHOOK_SECRET and processes payment events.',
          responses: { '200': { description: 'Acknowledged' }, '400': { description: 'Invalid signature' } },
        },
      },
    },
  },
});
