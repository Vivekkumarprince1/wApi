import { Router } from 'express';
import { flowController } from '../controllers/flowController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate as any);

router.get('/', flowController.listFlows as any);
router.post('/', flowController.createFlow as any);
router.get('/:flowId', flowController.getFlow as any);
router.post('/:flowId/action', flowController.executeAction as any);
router.delete('/:flowId', flowController.deleteFlow as any);

export default router;
