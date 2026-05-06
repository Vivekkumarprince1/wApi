import { Router } from 'express';
import { proxyController } from '../controllers/proxyController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Automation Proxy (Catch-all for /automation/*)
router.all(/\/automation(.*)/, authenticate, (req: any, res: any, next: any) => proxyController.proxyTo('automation', req, res, next));

// Campaign & Segments Proxy (Standardized to campaign service)
router.all(/(\/campaign|\/campaigns|\/segments)(.*)/, authenticate, (req: any, res: any, next: any) => proxyController.proxyTo('campaign', req, res, next));

// Billing Proxy (including workspace-nested billing routes)
router.all(/(\/billing|\/workspace\/billing)(.*)/, authenticate, (req: any, res: any, next: any) => proxyController.proxyTo('billing', req, res, next));

export default router;
