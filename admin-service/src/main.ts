import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { connectDb } from './legacy/config/db';
import { startAuditConsumer, stopAuditConsumer, disconnectKafkaProducer } from './legacy/services/kafkaService';
import adminRoutes from './legacy/routes/adminRoutes';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  
  app.use(cookieParser());
  
  // Connect to Database
  await connectDb();
  
  // Start Kafka audit consumer
  await startAuditConsumer();

  // Mount legacy Express router
  app.getHttpAdapter().getInstance().use('/api/admin', adminRoutes);

  const port = process.env.PORT ?? 3101;
  await app.listen(port);
  console.log(`[Admin Service] Running at http://localhost:${port}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Admin Service] Shutting down gracefully...');
    await disconnectKafkaProducer();
    await stopAuditConsumer();
    await app.close();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
bootstrap();
