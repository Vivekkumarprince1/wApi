import { Router } from 'express';
import { templateController } from '../controllers/templateController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authenticate, templateController.listTemplates);
router.post('/', authenticate, templateController.createTemplate);
router.get('/categories', authenticate, templateController.getCategories);
router.post('/sync', authenticate, templateController.syncTemplates);
router.get('/analytics/*path', authenticate, templateController.getAnalytics);
router.get('/library/stats', authenticate, templateController.getLibraryStats);
router.get('/rules', authenticate, templateController.listRules);
router.post('/rules', authenticate, templateController.createRule);
router.patch('/rules/:id', authenticate, templateController.updateRule);
router.delete('/rules/:id', authenticate, templateController.deleteRule);
router.patch('/rules/:id/toggle', authenticate, templateController.toggleRule);
router.post('/rules/:id/test', authenticate, templateController.testRule);
router.get('/rules/:id/stats', authenticate, templateController.getRuleStats);
router.post('/:id/submit', authenticate, templateController.submitTemplate);
router.get('/:id', authenticate, templateController.getTemplate);
router.put('/:id', authenticate, templateController.updateTemplate);
router.patch('/:id', authenticate, templateController.updateTemplate);
router.delete('/:id', authenticate, templateController.deleteTemplate);

export default router;
