/**
 * Server OpenAPI document.
 *
 * Strategy:
 *   - Each route group (auth, contacts, messages, campaigns, etc.) gets a
 *     `tag` here so Swagger UI groups them cleanly.
 *   - Concrete endpoint specs live in `manual.paths` below. As routes
 *     adopt Zod schemas, register them on `registry` and they will be
 *     merged in automatically.
 *
 * Mounted from `src/index.ts` via `mountSwaggerUI(app, openapiDocument)`.
 * Reachable at `http://localhost:5001/docs` (and `/docs/openapi.json`).
 */

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { buildOpenApiDocument } from '@wapi/contracts';

export const registry = new OpenAPIRegistry();

// Register concrete schemas here as routes adopt zod-to-openapi, e.g.:
//   registry.register('Contact', ContactSchema.openapi('Contact'));
//   registry.registerPath({ method: 'get', path: '/api/contacts', ... });

const generator = new OpenApiGeneratorV3(registry.definitions);
const generated = generator.generateComponents() as Record<string, any>;

export const openapiDocument = buildOpenApiDocument({
  info: {
    title: 'wApi — Server (API Gateway)',
    version: '1.0.0',
    description:
      'Core API gateway: auth, contacts, conversations, messages, templates, ' +
      'and proxies to automation / campaign / billing / bsp microservices.',
    servers: [{ url: 'http://localhost:5001', description: 'Local dev' }],
  },
  generated,
  manual: {
    tags: [
      { name: 'Auth', description: 'Login, register, OAuth (Google/Facebook), JWT' },
      { name: 'Contacts', description: 'Contact CRUD and bulk import' },
      { name: 'Conversations', description: 'Conversation threads and assignments' },
      { name: 'Messages', description: 'Send / receive WhatsApp messages' },
      { name: 'Templates', description: 'WhatsApp message template management' },
      { name: 'Campaigns', description: 'Broadcast campaigns (proxied to campaign-service)' },
      { name: 'Flows', description: 'WhatsApp Flow management' },
      { name: 'Integrations', description: 'Third-party integrations (Shopify, Wix, etc.)' },
      { name: 'Billing', description: 'Wallet & payment (proxied to billing-service)' },
      { name: 'Analytics', description: 'Metrics and dashboards' },
      { name: 'Admin', description: 'Super-admin operations' },
      { name: 'Webhooks', description: 'Provider webhooks (WhatsApp, Razorpay)' },
      { name: 'Internal', description: 'Service-to-service worker bridge (requires x-internal-service-secret)' },
      { name: 'Health', description: 'Liveness / readiness probes' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Service health check',
          responses: {
            '200': {
              description: 'Healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      service: { type: 'string', example: 'wapi-server' },
                      db: { type: 'string', example: 'connected' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email/password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', format: 'password' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Authenticated; JWT set in cookie + body' },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      '/api/internal/worker-bridge': {
        post: {
          tags: ['Internal'],
          summary: 'Service-to-service worker bridge',
          description:
            'Used by campaign-service, automation-service, and billing-service to ' +
            'invoke server-owned operations (template resolution, contact queries, ' +
            'socket broadcast, billing park/settle, etc.).',
          security: [{ internalServiceSecret: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action', 'payload'],
                  properties: {
                    action: {
                      type: 'string',
                      enum: [
                        'send-template',
                        'preflight-validate',
                        'socket-broadcast',
                        'get-pricing',
                        'get-template',
                        'get-contact',
                        'query-contacts',
                        'count-contacts',
                        'billing-park',
                        'billing-settle',
                      ],
                    },
                    payload: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Action result' },
            '401': { description: 'Missing or invalid internal service secret' },
          },
        },
      },
    },
  },
});
