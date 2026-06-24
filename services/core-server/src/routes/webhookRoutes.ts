import { Router } from 'express';
import { webhookController } from '../controllers/webhookController';

const router = Router();

// WhatsApp/Gupshup callbacks are public receiver endpoints. Provider
// signatures are optional and validated by the controller when present.
router.get('/whatsapp', webhookController.verifyWhatsApp);
router.post('/whatsapp', webhookController.handleWhatsApp);

// Razorpay Webhooks
router.post('/razorpay', webhookController.handleRazorpay);

export default router;
