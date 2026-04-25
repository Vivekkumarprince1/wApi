const express = require('express');
const router = express.Router();
const whatsappFormController = require('../../controllers/messaging/whatsappFormController');
const authMiddleware = require('../../middlewares/auth');

const { requireFeature } = require('../../middlewares/infrastructure/featureGate');

// All routes require authentication and WhatsApp Forms feature
router.use(authMiddleware);
router.use(requireFeature('WHATSAPP_FORMS'));

// Form interaction endpoints (MUST be before /:id routes to avoid catch-all)
router.post('/start', whatsappFormController.startWhatsAppFormResponse);
router.post('/answer', whatsappFormController.submitFormAnswer);

// Form CRUD operations
router.post('/', whatsappFormController.createWhatsAppForm);
router.get('/', whatsappFormController.listWhatsAppForms);

// Form publishing
router.post('/:id/publish', whatsappFormController.publishWhatsAppForm);
router.post('/:id/unpublish', whatsappFormController.unpublishWhatsAppForm);

// Form responses
router.get('/:id/responses', whatsappFormController.getWhatsAppFormResponses);
router.post('/:id/sync', whatsappFormController.syncFormData);

// Form statistics
router.get('/:id/stats', whatsappFormController.getFormStats);

// Single form operations (MUST be last to avoid catching other routes)
router.get('/:id', whatsappFormController.getWhatsAppForm);
router.put('/:id', whatsappFormController.updateWhatsAppForm);
router.delete('/:id', whatsappFormController.deleteWhatsAppForm);

module.exports = router;
