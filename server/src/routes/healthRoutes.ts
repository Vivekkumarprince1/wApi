import { Router, Request, Response } from 'express';
import { config } from '@/config';
import { authenticate, isSuperAdmin } from '@/middlewares/authMiddleware';
import { BspServiceClient } from '@/services/microservices/bsp-service-client';

const router = Router();

router.use(authenticate, isSuperAdmin);

router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const data = await BspServiceClient.request({
      method: 'GET',
      path: '/internal/v1/bsp/admin/webhook-status',
    });
    res.json({ status: 'ok', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const data = await BspServiceClient.request({
      method: 'GET',
      path: '/internal/v1/bsp/admin/health',
    });
    res.json({ status: 'ok', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/signature-verification', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    delegatedTo: config.bspServiceUrl,
    configured: true,
    requirements: {
      secret: 'Managed by bsp-service',
      verifyToken: 'Managed by bsp-service',
    },
  });
});

export default router;
