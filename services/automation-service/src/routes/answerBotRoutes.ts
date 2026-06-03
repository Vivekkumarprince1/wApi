import { Router } from 'express';
import * as AnswerBotController from '../controllers/AnswerBotController';
import * as FaqController from '../controllers/FaqController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Settings & Sources
router.get('/answerbot/settings', authenticate, AnswerBotController.getSettings);
router.patch('/answerbot/settings', authenticate, authorize(['owner', 'admin']), AnswerBotController.updateSettings);
router.get('/answerbot/sources', authenticate, AnswerBotController.getSources);
router.post('/answerbot/sources', authenticate, authorize(['owner', 'admin']), AnswerBotController.createSource);

// FAQs
router.get('/answerbot/faqs', authenticate, FaqController.getFaqs);
router.post('/answerbot/faqs', authenticate, authorize(['owner', 'admin']), FaqController.createFaq);
router.post('/answerbot/faqs/approve', authenticate, authorize(['owner', 'admin']), FaqController.approveFaqs);
router.post('/answerbot/faqs/generate', authenticate, authorize(['owner', 'admin']), FaqController.generateFaqs);
router.patch('/answerbot/faqs/:id', authenticate, authorize(['owner', 'admin']), FaqController.updateFaq);
router.delete('/answerbot/faqs/:id', authenticate, authorize(['owner', 'admin']), FaqController.deleteFaq);

export default router;
