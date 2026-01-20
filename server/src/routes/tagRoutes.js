/**
 * Tag Routes - Stage 5 CRM
 * 
 * Routes for tag management:
 * - GET    /api/v1/tags                    - Get all tags
 * - POST   /api/v1/tags                    - Create tag
 * - PUT    /api/v1/tags/:tagId             - Update tag
 * - DELETE /api/v1/tags/:tagId             - Delete tag
 * - GET    /api/v1/tags/analytics          - Tag usage analytics
 * - GET    /api/v1/tags/filter/contacts    - Filter contacts by tags
 * - GET    /api/v1/tags/filter/conversations - Filter conversations by tags
 * - POST   /api/v1/tags/bulk/contacts      - Bulk add tags to contacts
 * - DELETE /api/v1/tags/bulk/contacts      - Bulk remove tags from contacts
 */

const express = require('express');
const auth = require('../middlewares/auth');
const tagsController = require('../controllers/tagsController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ═══════════════════════════════════════════════════════════════════════════
// TAG CRUD
// ═══════════════════════════════════════════════════════════════════════════

// Get all tags for workspace
router.get('/', tagsController.getTags);

// Create a new tag
router.post('/', tagsController.createTag);

// Update a tag
router.put('/:tagId', tagsController.updateTag);

// Delete a tag
router.delete('/:tagId', tagsController.deleteTag);

// ═══════════════════════════════════════════════════════════════════════════
// TAG ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

// Get tag usage analytics
router.get('/analytics', tagsController.getTagAnalytics);

// ═══════════════════════════════════════════════════════════════════════════
// FILTERING BY TAGS
// ═══════════════════════════════════════════════════════════════════════════

// Get contacts filtered by tags
router.get('/filter/contacts', tagsController.getContactsByTags);

// Get conversations filtered by tags
router.get('/filter/conversations', tagsController.getConversationsByTags);

// ═══════════════════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

// Bulk add tags to contacts
router.post('/bulk/contacts', tagsController.bulkAddTagsToContacts);

// Bulk remove tags from contacts
router.delete('/bulk/contacts', tagsController.bulkRemoveTagsFromContacts);

module.exports = router;
