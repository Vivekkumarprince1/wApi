const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck } = require('../middlewares/planCheck');
const { 
  validateTemplateCreate, 
  validateTemplateUpdate 
} = require('../middlewares/templateValidation');
const {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplate,
  syncTemplates,
  duplicateTemplate,
  validateTemplatePreview,
  getTemplateCategories
} = require('../controllers/templateController');

const router = express.Router();

router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CRUD ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Create new template (with validation middleware)
router.post('/', planCheck('templates', 1), validateTemplateCreate, createTemplate);

// List templates with filtering
router.get('/', listTemplates);

// Get template categories with counts
router.get('/categories', getTemplateCategories);

// Sync templates from Meta
router.get('/sync', syncTemplates);

// Validate template preview (without saving)
router.post('/validate', validateTemplatePreview);

// Get single template
router.get('/:id', getTemplate);

// Update template (with validation middleware)
router.put('/:id', validateTemplateUpdate, updateTemplate);

// Delete template
router.delete('/:id', deleteTemplate);

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE ACTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Submit template to Meta for approval
router.post('/:id/submit', submitTemplate);

// Duplicate an existing template
router.post('/:id/duplicate', planCheck('templates', 1), duplicateTemplate);

module.exports = router;
