const express = require('express');
const { body } = require('express-validator');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/infrastructure/validate');
const { requireFeature } = require('../../middlewares/infrastructure/featureGate');
const {
  createDeal,
  listDeals,
  getDeal,
  moveStage,
  updateDeal,
  addNote,
  getDealsByContact,
  getDealsByStage,
  deleteDeal
} = require('../../controllers/commerce/dealController');

const router = express.Router();

// Authentication is required for all routes
router.use(auth);

// Helper to protect routes specifically with CRM feature
const requireCRM = requireFeature('CRM');

// Create a new deal (add contact to pipeline)
router.post(
  '/',
  requireCRM,
  [
    body('contactId').notEmpty().withMessage('Contact ID is required'),
    body('pipelineId').notEmpty().withMessage('Pipeline ID is required'),
    body('title').optional().isString().withMessage('Deal title must be a string')
  ],
  validate,
  createDeal
);

// List deals with filtering
router.get('/', requireCRM, listDeals);

// Get deals by pipeline and stage (for pipeline view)
router.get('/pipeline/:pipelineId/stages', requireCRM, getDealsByStage);

// Get deals by contact (Accessible by CRM or INBOX users)
router.get('/contact/:contactId', requireFeature(['CRM', 'INBOX']), getDealsByContact);

// Get single deal
router.get('/:id', requireCRM, getDeal);

// Move deal to different stage
router.post(
  '/:id/move',
  requireCRM,
  [body('stageId').notEmpty().withMessage('Stage ID is required')],
  validate,
  moveStage
);

// Update deal details
router.put(
  '/:id',
  requireCRM,
  [body('title').optional().notEmpty()],
  validate,
  updateDeal
);

// Add note to deal
router.post(
  '/:id/notes',
  requireCRM,
  [body('text').notEmpty().withMessage('Note text is required')],
  validate,
  addNote
);

// Delete deal
router.delete('/:id', requireCRM, deleteDeal);

module.exports = router;
