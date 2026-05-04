import { Router } from 'express';
import { webhookController } from '../controllers/webhookController';

const router = Router();

// WhatsApp Webhooks (No session auth, use signature verification)
router.get('/whatsapp', webhookController.verifyWhatsApp);
router.post('/whatsapp', webhookController.handleWhatsApp);

// Razorpay Webhooks
router.post('/razorpay', webhookController.handleRazorpay);

export default router;
