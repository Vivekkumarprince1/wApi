const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
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
} = require('../controllers/dealController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Create a new deal (add contact to pipeline)
router.post(
  '/',
  [
    body('contactId').notEmpty().withMessage('Contact ID is required'),
    body('pipelineId').notEmpty().withMessage('Pipeline ID is required'),
    body('title').notEmpty().withMessage('Deal title is required')
  ],
  validate,
  createDeal
);

// List deals with filtering
router.get('/', listDeals);

// Get deals by pipeline and stage (for pipeline view)
router.get('/pipeline/:pipelineId/stages', getDealsByStage);

// Get deals by contact
router.get('/contact/:contactId', getDealsByContact);

// Get single deal
router.get('/:id', getDeal);

// Move deal to different stage
router.post(
  '/:id/move',
  [body('stageId').notEmpty().withMessage('Stage ID is required')],
  validate,
  moveStage
);

// Update deal details
router.put(
  '/:id',
  [body('title').optional().notEmpty()],
  validate,
  updateDeal
);

// Add note to deal
router.post(
  '/:id/notes',
  [body('text').notEmpty().withMessage('Note text is required')],
  validate,
  addNote
);

// Delete deal
router.delete('/:id', deleteDeal);

module.exports = router;
