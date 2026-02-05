const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck } = require('../middlewares/planCheck');
const { requirePhoneActivation } = require('../middlewares/phoneActivation');
const { 
  validateTemplateCreate, 
  validateTemplateUpdate 
} = require('../middlewares/templateValidation');
const {
  getApprovedTemplatesForWorkspace,
  getTemplateStatusCounts
} = require('../middlewares/templateGuard');
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
  getTemplateCategories,
  getTemplateLibraryStats,
  forkApprovedTemplate,
  getTemplateVersions
} = require('../controllers/templateController');

const router = express.Router();

router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE GUARD ROUTES (Stage 2 - Task 6)
// Use these for campaign/auto-reply/workflow template selection
// ═══════════════════════════════════════════════════════════════════════════════

// Get ONLY approved templates (for sending contexts)
router.get('/approved', getApprovedTemplatesForWorkspace);

// Get template status counts (for dashboard)
router.get('/status-counts', getTemplateStatusCounts);

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CRUD ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Create new template (with validation middleware)
// Stage 1: Requires phone activation for template creation
router.post('/', requirePhoneActivation, planCheck('templates', 1), validateTemplateCreate, createTemplate);

// List templates with filtering (read-only, no activation required)
router.get('/', listTemplates);

// Get template categories with counts (read-only)
router.get('/categories', getTemplateCategories);

// Get library stats (total, by category, by status)
router.get('/stats', getTemplateLibraryStats);

// Sync templates from Meta (requires activation)
router.get('/sync', requirePhoneActivation, syncTemplates);

// Validate template preview (without saving) - no activation required
router.post('/validate', validateTemplatePreview);

// Get single template (read-only)
router.get('/:id', getTemplate);

// Get all versions of a template (Stage 2 Hardening - Task A)
router.get('/:id/versions', getTemplateVersions);

// Update template (with validation middleware)
// Stage 2 Hardening: If template is APPROVED, this will fork it instead
router.put('/:id', requirePhoneActivation, validateTemplateUpdate, updateTemplate);

// Delete template (requires activation for Meta sync)
// Stage 2 Hardening: Blocked if template is used in campaigns
router.delete('/:id', requirePhoneActivation, deleteTemplate);

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE ACTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Submit template to Meta for approval (REQUIRES Stage 1 complete)
// Stage 2 Hardening: Captures metaPayloadSnapshot for audit
router.post('/:id/submit', requirePhoneActivation, submitTemplate);

// Duplicate an existing template
router.post('/:id/duplicate', planCheck('templates', 1), duplicateTemplate);

// Fork an approved template for editing (Stage 2 Hardening - Task A)
// Creates new DRAFT version while keeping original APPROVED and usable
router.post('/:id/fork', requirePhoneActivation, planCheck('templates', 1), forkApprovedTemplate);

module.exports = router;
