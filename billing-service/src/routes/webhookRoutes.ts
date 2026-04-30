import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';

const router = Router();

// Handle Razorpay Webhooks
router.post('/razorpay', WalletController.handleRazorpayWebhook);

export default router;
