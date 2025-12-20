const express = require('express');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { body } = require('express-validator');
const { 
  createContact, 
  uploadContacts,
  listContacts, 
  getContactStats,
  getContact, 
  getContactWhatsAppProfile,
  updateContact, 
  deleteContact 
} = require('../controllers/contactController');

const router = express.Router();

router.use(auth);
router.post('/', [body('phone').notEmpty()], validate, createContact);
router.post('/upload', [body('contacts').isArray()], validate, uploadContacts);
router.get('/', listContacts);
router.get('/:id/whatsapp-profile', getContactWhatsAppProfile);
router.get('/stats', getContactStats);
router.get('/:id', getContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;
