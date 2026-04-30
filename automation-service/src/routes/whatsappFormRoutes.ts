import { Router } from 'express';
import * as WhatsAppFormController from '../controllers/WhatsAppFormController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/whatsapp-forms', authenticate, WhatsAppFormController.getForms);
router.get('/whatsapp-forms/:id', authenticate, WhatsAppFormController.getFormById);
router.post('/whatsapp-forms', authenticate, WhatsAppFormController.createForm);
router.put('/whatsapp-forms/:id', authenticate, WhatsAppFormController.updateForm);
router.patch('/whatsapp-forms/:id', authenticate, WhatsAppFormController.updateForm);
router.delete('/whatsapp-forms/:id', authenticate, WhatsAppFormController.deleteForm);

router.post('/whatsapp-forms/:id/publish', authenticate, WhatsAppFormController.publishForm);
router.post('/whatsapp-forms/:id/unpublish', authenticate, WhatsAppFormController.unpublishForm);
router.post('/whatsapp-forms/:id/sync', authenticate, WhatsAppFormController.syncForm);
router.get('/whatsapp-forms/:id/responses', authenticate, WhatsAppFormController.getResponses);

export default router;
