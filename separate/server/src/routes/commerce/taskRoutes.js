const express = require('express');
const { body } = require('express-validator');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/infrastructure/validate');
const {
  createTask,
  listTasks,
  getTask,
  updateTask,
  toggleTaskStatus,
  deleteTask
} = require('../../controllers/commerce/taskController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Create a new task
router.post(
  '/',
  [
    body('title').notEmpty().withMessage('Task title is required'),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Priority must be Low, Medium, or High')
  ],
  validate,
  createTask
);

// List tasks with filtering
router.get('/', listTasks);

// Get single task
router.get('/:id', getTask);

// Update a task
router.put(
  '/:id',
  [body('title').optional().notEmpty()],
  validate,
  updateTask
);

// Toggle task status (Pending <-> Completed)
router.post('/:id/toggle', toggleTaskStatus);

// Delete task
router.delete('/:id', deleteTask);

module.exports = router;
