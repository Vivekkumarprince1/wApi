import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { config } from './config';
import { correlationIdMiddleware, logger as winstonLogger } from './common/logger';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Stamp every request with x-correlation-id and bind it into AsyncLocalStorage
  // so the winston logger automatically includes it on any log call.
  app.use(correlationIdMiddleware);

  // --- Swagger / OpenAPI ---
  // NestJS generates the spec from controllers + class-validator DTOs. The
  // raw spec is served at /docs/openapi.json so it can be consumed by tooling.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('wApi — BSP Service')
    .setDescription(
      'Gupshup Business Service Provider integration: apps, onboarding, ' +
      'tokens, phones, templates, media, profiles, webhooks, and ESB flows.',
    )
    .setVersion('1.0.0')
    .addServer(`http://localhost:${config.port}`, 'Local dev')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearerAuth')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-internal-service-secret' },
      'internalServiceSecret',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.port, '0.0.0.0');
  const log = new Logger('Bootstrap');
  log.log(`BSP Service listening on port ${config.port}`);
  log.log(`Swagger UI: http://localhost:${config.port}/docs`);
  winstonLogger.info('bsp.boot', { port: config.port });
}

bootstrap().catch((err) => {
  winstonLogger.error('bsp.boot.fatal', { error: err?.message, stack: err?.stack });
  process.exit(1);
});
