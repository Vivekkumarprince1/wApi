/**
 * Internal Notes Routes - Stage 4 Hardening
 * 
 * Routes for agent-only internal notes
 */

const express = require('express');
const router = express.Router();
const internalNotesController = require('../controllers/internalNotesController');
const auth = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');

// All routes require authentication and workspace access
router.use(auth);

// Search notes (before dynamic routes)
router.get(
  '/notes/search',
  requireRole(['owner', 'admin', 'manager', 'agent']),
  internalNotesController.searchNotes
);

// Conversation notes
router.post(
  '/:conversationId/notes',
  requireRole(['owner', 'admin', 'manager', 'agent']),
  internalNotesController.createNote
);

router.get(
  '/:conversationId/notes',
  requireRole(['owner', 'admin', 'manager', 'agent']),
  internalNotesController.getNotes
);

router.put(
  '/:conversationId/notes/:noteId',
  requireRole(['owner', 'admin', 'manager', 'agent']),
  internalNotesController.updateNote
);

router.delete(
  '/:conversationId/notes/:noteId',
  requireRole(['owner', 'admin', 'manager', 'agent']),
  internalNotesController.deleteNote
);

module.exports = router;
