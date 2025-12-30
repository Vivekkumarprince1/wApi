const express = require('express');
const auth = require('../middlewares/auth');
const {
  getPipelinePerformance,
  getFunnelReport,
  getAgentPerformance,
  getDealVelocity,
  getStageDuration
} = require('../controllers/salesReportsController');

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * Pipeline Performance Report
 * GET /api/reports/pipeline-performance
 * Filters: pipelineId, startDate, endDate
 */
router.get('/pipeline-performance', getPipelinePerformance);

/**
 * Funnel Report
 * GET /api/reports/funnel
 * Filters: pipelineId (required), startDate, endDate
 */
router.get('/funnel', getFunnelReport);

/**
 * Agent Performance Report
 * GET /api/reports/agent-performance
 * Filters: agentId, startDate, endDate
 */
router.get('/agent-performance', getAgentPerformance);

/**
 * Deal Velocity Report
 * GET /api/reports/deal-velocity
 * Filters: pipelineId, startDate, endDate
 */
router.get('/deal-velocity', getDealVelocity);

/**
 * Stage Duration Report
 * GET /api/reports/stage-duration
 * Filters: pipelineId (required), startDate, endDate
 */
router.get('/stage-duration', getStageDuration);

module.exports = router;
