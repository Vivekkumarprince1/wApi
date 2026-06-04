import { Router } from 'express';
import { flowController } from '../controllers/flowController';
import { authenticate } from '../middleware/auth';

const router = Router();

// To be bulletproof for stripped/proxied paths, we register both relative subpaths and fully-qualified gateway paths
const paths = ['', '/api/v1/flows'];

for (const p of paths) {
  router.get(`${p}/`, authenticate, flowController.listFlows);
  router.post(`${p}/`, authenticate, flowController.createFlow);
  router.get(`${p}/:flowId`, authenticate, flowController.getFlow);
  router.post(`${p}/:flowId/action`, authenticate, flowController.executeAction);
  router.delete(`${p}/:flowId`, authenticate, flowController.deleteFlow);
}

export default router;
