const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/infrastructure/validate');
const { body } = require('express-validator');
const { 
  createContact, 
  bulkImportContacts,
  listContacts, 
  getContactStats,
  getContact, 
  updateContact, 
  deleteContact 
} = require('../../controllers/messaging/contactController');
const tagsController = require('../../controllers/messaging/tagsController');

const router = express.Router();

router.use(auth);
router.post('/', [body('phone').notEmpty()], validate, createContact);
router.post('/upload', [body('contacts').isArray()], validate, bulkImportContacts);
router.get('/', listContacts);
// router.get('/:id/whatsapp-profile', getContactWhatsAppProfile); // TODO: Implement this function
router.get('/stats', getContactStats);
router.get('/:id', getContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

// Stage 5: CRM Tagging
router.post('/:contactId/tags', tagsController.addTagsToContact);
router.delete('/:contactId/tags', tagsController.removeTagsFromContact);

module.exports = router;
