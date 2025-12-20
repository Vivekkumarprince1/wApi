const express = require('express');
const auth = require('../middlewares/auth');
const {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplate,
  syncTemplates,
  syncTemplateLibrary,
  copyFromLibrary,
  getHardcodedLibraryTemplates,
  getTemplateCategories,
  getTemplateLibraryStats
} = require('../controllers/templateController');

const router = express.Router();

router.use(auth);

router.post('/', createTemplate);
router.get('/', listTemplates);
router.get('/categories', getTemplateCategories);
router.get('/stats', getTemplateLibraryStats);
router.get('/sync', syncTemplates);

// Template Library routes
router.get('/library', getHardcodedLibraryTemplates);        // Get pre-defined library templates
router.get('/library/sync', syncTemplateLibrary);            // Sync from Meta's Template Library API
router.post('/library/copy', copyFromLibrary);               // Copy a template from library

router.get('/:id', getTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/submit', submitTemplate);

module.exports = router;
