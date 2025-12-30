const express = require('express');
const auth = require('../middlewares/auth');
const { 
  createRule, 
  listRules, 
  getRule, 
  updateRule, 
  deleteRule, 
  toggleRule,
  getExecutions,
  getAnalytics
} = require('../controllers/automationController');

const answerBotRoutes = require('./answerbotRoutes');

const router = express.Router();
router.use(auth);

// AnswerBot routes (nested under /api/v1/automation/answerbot)
router.use('/answerbot', answerBotRoutes);

// Workflow CRUD
router.post('/', createRule);
router.get('/', listRules);
router.get('/analytics', getAnalytics);
router.get('/:id', getRule);
router.put('/:id', updateRule);
router.delete('/:id', deleteRule);

// Workflow actions
router.post('/:id/toggle', toggleRule);
router.get('/:id/executions', getExecutions);

module.exports = router;
