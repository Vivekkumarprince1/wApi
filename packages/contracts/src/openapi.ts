/**
 * Shared OpenAPI helper for the Express services.
 *
 * Each service builds a minimal OpenAPI document with `buildOpenApiDocument`
 * (optionally registering Zod schemas via `OpenAPIRegistry` from
 * `@asteasolutions/zod-to-openapi`) and mounts it with `mountSwaggerUI`.
 *
 * - The bsp-service uses `@nestjs/swagger` directly instead of this helper,
 *   since NestJS already wires Swagger from controllers + DTOs.
 * - This helper deliberately avoids hard-importing `@asteasolutions/zod-to-openapi`
 *   so services without Zod schemas (e.g. billing) can still use the basic
 *   document builder with empty `components`.
 */

export interface OpenApiServiceInfo {
  title: string;
  version: string;
  description?: string;
  /** Base URLs the service is reachable at, e.g. http://localhost:3002 */
  servers?: { url: string; description?: string }[];
}

export interface BuildOpenApiOptions {
  info: OpenApiServiceInfo;
  /** Pre-built `components`/`paths` from `OpenAPIRegistry.definitions` (optional). */
  generated?: Record<string, any>;
  /** Manually authored paths/components merged on top of `generated`. */
  manual?: {
    paths?: Record<string, any>;
    components?: Record<string, any>;
    tags?: { name: string; description?: string }[];
  };
}

export function buildOpenApiDocument(opts: BuildOpenApiOptions) {
  const doc: any = {
    openapi: '3.0.3',
    info: {
      title: opts.info.title,
      version: opts.info.version,
      description: opts.info.description,
    },
    servers: opts.info.servers || [],
    tags: opts.manual?.tags || [],
    paths: {
      ...(opts.generated?.paths || {}),
      ...(opts.manual?.paths || {}),
    },
    components: {
      ...(opts.generated?.components || {}),
      ...(opts.manual?.components || {}),
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        internalServiceSecret: {
          type: 'apiKey',
          in: 'header',
          name: 'x-internal-service-secret',
        },
      },
    },
  };
  return doc;
}

/**
 * Mounts Swagger UI at `/docs` and serves the JSON at `/docs/openapi.json`.
 * Pass any Express-compatible `app` instance.
 *
 * Requires the host service to install `swagger-ui-express`.
 */
export function mountSwaggerUI(app: any, document: any, path = '/docs') {
  let swaggerUi: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    swaggerUi = require('swagger-ui-express');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[openapi] Skipping Swagger UI at ${path} — install swagger-ui-express to enable: ${(err as Error).message}`,
    );
    return;
  }

  app.get(`${path}/openapi.json`, (_req: any, res: any) => {
    res.json(document);
  });
  app.use(path, swaggerUi.serve, swaggerUi.setup(document, { explorer: true }));
}
