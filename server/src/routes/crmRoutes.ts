import { Router } from 'express';
import { body } from 'express-validator';
import { crmController } from '../controllers/crmController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { requirePermission } from '../middlewares/permissionMiddleware';

const router = Router();

router.use(authenticate);

// Pipelines
router.get('/pipelines', requirePermission('crm.view'), crmController.getPipelines);

// Analytics
router.get('/analytics', requirePermission('crm.view'), crmController.getAnalytics);

// Deals
router.get('/deals', requirePermission('crm.view'), crmController.getDeals);

router.post('/deals', 
  requirePermission('crm.edit'),
  validate([
    body('title').notEmpty().isString(),
    body('value').isNumeric(),
    body('contactId').notEmpty().isMongoId()
  ]),
  crmController.createDeal
);

router.get('/deals/:id', requirePermission('crm.view'), crmController.getDeal);

router.patch('/deals/:id', 
  requirePermission('crm.edit'),
  validate([
    body('title').optional().isString(),
    body('value').optional().isNumeric()
  ]),
  crmController.updateDeal
);

router.delete('/deals/:id', requirePermission('crm.delete'), crmController.deleteDeal);

router.patch('/deals/:id/stage', 
  requirePermission('crm.edit'),
  validate([body('stageId').notEmpty().isString()]),
  crmController.updateDealStage
);

router.post('/deals/:id/notes', 
  requirePermission('crm.edit'),
  validate([body('text').optional().isString(), body('content').optional().isString()]),
  crmController.addDealNote
);

// Contact specific deals (compatibility)
router.get('/contacts/:contactId/deals', requirePermission('crm.view'), crmController.getDeals);

// Tasks
router.get('/tasks', requirePermission('crm.view'), crmController.getTasks);

router.post('/tasks', 
  requirePermission('crm.edit'),
  validate([
    body('title').notEmpty().isString(),
    body('dueDate').optional().isISO8601()
  ]),
  crmController.createTask
);
router.patch('/tasks/:id/status', requirePermission('crm.edit'), crmController.updateTaskStatus);
router.patch('/tasks/:id', requirePermission('crm.edit'), crmController.updateTask);
router.delete('/tasks/:id', requirePermission('crm.delete'), crmController.deleteTask);

// Automation
router.get('/automation', requirePermission('crm.view'), crmController.getAutomationRules);
router.post('/automation', requirePermission('crm.edit'), crmController.saveAutomationRule);
router.delete('/automation', requirePermission('crm.edit'), crmController.deleteAutomationRule);

export default router;
