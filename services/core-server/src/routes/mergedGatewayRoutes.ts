import { Express, NextFunction, Request, Response } from 'express';
import axios from 'axios';

import { config } from '../config';
import { proxyMiddleware } from '../middlewares/proxyMiddleware';
import { authenticate } from '../middlewares/authMiddleware';
import { proxyController } from '../controllers/proxyController';

type AdminService = 'core' | 'websocket' | 'automation' | 'campaign' | 'billing';

const adminServiceUrls: Record<AdminService, string> = {
  core: `http://127.0.0.1:${process.env.BACKEND_PORT || process.env.PORT || '5001'}`,
  websocket: `http://127.0.0.1:${process.env.BACKEND_PORT || process.env.PORT || '5001'}`,
  automation: config.automationServiceUrl,
  campaign: config.campaignServiceUrl,
  billing: config.billingServiceUrl,
};

function getCorrelationId(req: Request) {
  const incoming = req.headers['x-correlation-id'];
  return typeof incoming === 'string' && incoming
    ? incoming
    : `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function verifyInternalSecret(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-internal-service-secret'] !== config.internalServiceSecret) {
    return res.status(401).json({ error: 'Unauthorized internal service secret' });
  }
  return next();
}

async function proxyAdminRequest(req: Request, res: Response) {
  const service = req.params.service as AdminService;
  const targetBaseUrl = adminServiceUrls[service];

  if (!targetBaseUrl) {
    return res.status(404).json({ error: `Unknown service: ${service}` });
  }

  const cleanPath = req.originalUrl.replace(new RegExp(`^/api/admin/${service}`), '') || '/';
  const headers = proxyController.buildProxyHeaders({
    correlationId: getCorrelationId(req),
    userRole: 'system',
  });

  try {
    const response = await axios({
      method: req.method,
      url: `${targetBaseUrl}${cleanPath}`,
      data: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : req.body,
      params: req.query,
      headers,
      timeout: 8000,
      responseType: cleanPath.includes('/metrics') ? 'text' : 'json',
      validateStatus: () => true,
    });

    const contentType = response.headers['content-type'];
    if (contentType && typeof contentType === 'string') {
      res.setHeader('Content-Type', contentType);
    }
    res.setHeader('x-correlation-id', headers['x-correlation-id']);

    return res.status(response.status).send(response.data);
  } catch (error: any) {
    return res.status(502).json({
      success: false,
      error: 'BAD_GATEWAY',
      message: 'Admin service proxy failed',
      details: error.message,
      correlationId: headers['x-correlation-id'],
    });
  }
}

export function registerMergedGatewayRoutes(app: Express) {
  app.use('/api/v1/automation', authenticate, proxyMiddleware.proxyTo('automation'));
  app.use('/api/v1/campaign', authenticate, proxyMiddleware.proxyTo('campaign'));
  app.use('/api/v1/billing', authenticate, proxyMiddleware.proxyTo('billing'));

  app.use('/api/admin/:service', verifyInternalSecret, proxyAdminRequest);
}
