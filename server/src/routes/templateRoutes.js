const express = require('express');
const auth = require('../middlewares/auth');
const { planCheck } = require('../middlewares/planCheck');
const {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplate,
  syncTemplates,
  getTemplateCategories
} = require('../controllers/templateController');

const router = express.Router();

router.use(auth);

router.post('/', planCheck('templates', 1), createTemplate);
router.get('/', listTemplates);
router.get('/categories', getTemplateCategories);
router.get('/sync', syncTemplates);
router.get('/:id', getTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/submit', submitTemplate);

module.exports = router;
