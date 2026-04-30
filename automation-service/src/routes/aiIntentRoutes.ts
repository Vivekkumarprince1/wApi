import { Router } from 'express';
import * as AiIntentController from '../controllers/AiIntentController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/ai-intent', authenticate, AiIntentController.getAiIntentRules);
router.get('/ai-intent/:id', authenticate, AiIntentController.getAiIntentRuleById);
router.post('/ai-intent', authenticate, AiIntentController.createAiIntentRule);
router.patch('/ai-intent/:id', authenticate, AiIntentController.updateAiIntentRule);
router.put('/ai-intent/:id', authenticate, AiIntentController.updateAiIntentRule);
router.delete('/ai-intent/:id', authenticate, AiIntentController.deleteAiIntentRule);

export default router;
