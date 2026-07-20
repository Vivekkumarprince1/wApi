/**
 * Automation-service OpenAPI document.
 *
 * Mounted from `src/index.ts` via `mountSwaggerUI(app, openapiDocument)`.
 * Reachable at `http://localhost:3001/docs`.
 */

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { buildOpenApiDocument } from '@wapi/contracts';

export const registry = new OpenAPIRegistry();

const generator = new OpenApiGeneratorV3(registry.definitions);
const generated = generator.generateComponents() as Record<string, any>;

export const openapiDocument = buildOpenApiDocument({
  info: {
    title: 'wApi — Automation Service',
    version: '1.0.0',
    description:
      'Workflow / automation engine: AI intents, answer-bot rules, interactive ' +
      'lists and WhatsApp form handling.',
    servers: [{ url: 'http://localhost:3001', description: 'Local dev' }],
  },
  generated,
  manual: {
    tags: [
      { name: 'AI Intent', description: 'AI-based intent detection routes' },
      { name: 'Answer Bot', description: 'Rule-based answer bot routes' },
      { name: 'Engine', description: 'Core workflow engine routes' },
      { name: 'Interactive List', description: 'WhatsApp interactive list handlers' },
      { name: 'WhatsApp Form', description: 'WhatsApp form-message handlers' },
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
                      service: { type: 'string', example: 'automation-service' },
                      db: { type: 'string', example: 'connected' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/automation/engine/execute': {
        post: {
          tags: ['Engine'],
          summary: 'Execute an automation rule for an incoming event',
          security: [{ internalServiceSecret: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workspaceId: { type: 'string' },
                    event: { type: 'string', example: 'message.inbound' },
                    contactId: { type: 'string' },
                    payload: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Execution result' } },
        },
      },
    },
  },
});
