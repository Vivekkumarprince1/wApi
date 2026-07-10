/**
 * Campaign-service OpenAPI document.
 *
 * Mounted from `src/index.ts` via `mountSwaggerUI(app, openapiDocument)`.
 * Reachable at `http://localhost:3002/docs`.
 */

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { buildOpenApiDocument } from '@connectsphere/contracts';

export const registry = new OpenAPIRegistry();

const generator = new OpenApiGeneratorV3(registry.definitions);
const generated = generator.generateComponents() as Record<string, any>;

export const openapiDocument = buildOpenApiDocument({
  info: {
    title: 'ConnectSphere — Campaign Service',
    version: '1.0.0',
    description:
      'Broadcast & template messaging management. Handles campaign creation, ' +
      'segment resolution, batching, and message dispatch via the server worker-bridge.',
    servers: [{ url: 'http://localhost:3002', description: 'Local dev' }],
  },
  generated,
  manual: {
    tags: [
      { name: 'Campaigns', description: 'Campaign CRUD, scheduling, status' },
      { name: 'Segments', description: 'Audience segments / targeting' },
      { name: 'Health', description: 'Liveness / readiness probes' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Service health check',
          responses: {
            '200': { description: 'Healthy' },
          },
        },
      },
      '/api/campaign': {
        post: {
          tags: ['Campaigns'],
          summary: 'Create a new campaign',
          security: [{ bearerAuth: [] }, { internalServiceSecret: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['workspaceId', 'name', 'templateId'],
                  properties: {
                    workspaceId: { type: 'string' },
                    name: { type: 'string' },
                    templateId: { type: 'string' },
                    segmentId: { type: 'string', nullable: true },
                    scheduledAt: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Campaign created' },
            '400': { description: 'Validation error' },
          },
        },
        get: {
          tags: ['Campaigns'],
          summary: 'List campaigns',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'workspaceId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Campaign list' } },
        },
      },
      '/api/campaign/{id}': {
        get: {
          tags: ['Campaigns'],
          summary: 'Get a campaign by id',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Campaign' }, '404': { description: 'Not found' } },
        },
      },
    },
  },
});
