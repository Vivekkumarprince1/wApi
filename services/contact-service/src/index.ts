import config from './config/index.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { connectDb } from './config/db.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

// Mount aggregated API Router
app.use('/', apiRouter);

// Global Error Handler
app.use(errorHandler);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'wapi-contact-service' });
});

app.get('/', (req, res) => {
  res.json({ service: 'wapi-contact-service', healthy: true });
});

async function start() {
  await connectDb();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Contact Service] Running at http://localhost:${config.port}`);
  });
}

start();
export default app;
