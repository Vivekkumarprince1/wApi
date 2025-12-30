const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  createPipeline,
  listPipelines,
  getPipeline,
  updatePipeline,
  deletePipeline,
  getDefaultPipeline
} = require('../controllers/pipelineController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Create a new pipeline
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Pipeline name is required'),
    body('stages').isArray().withMessage('Stages must be an array')
  ],
  validate,
  createPipeline
);

// List all pipelines
router.get('/', listPipelines);

// Get default pipeline (auto-creates if doesn't exist)
router.get('/default/pipeline', getDefaultPipeline);

// Get single pipeline
router.get('/:id', getPipeline);

// Update pipeline
router.put(
  '/:id',
  [body('name').optional().notEmpty()],
  validate,
  updatePipeline
);

// Delete pipeline
router.delete('/:id', deletePipeline);

module.exports = router;
