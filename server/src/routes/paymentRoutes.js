const express = require('express');
const {
  getPlans,
  createOrder,
  verifyPayment,
  getSubscription,
  cancelSubscription,
  handleWebhook,
  updateBillingInfo
} = require('../controllers/paymentController');
const auth = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/plans', getPlans);

// Webhook route (no auth required, verified by signature)
router.post('/webhook', handleWebhook);

// Protected routes
router.post('/create-order', auth, createOrder);
router.post('/verify', auth, verifyPayment);
router.get('/subscription', auth, getSubscription);
router.post('/cancel-subscription', auth, cancelSubscription);
router.put('/billing-info', auth, updateBillingInfo);

module.exports = router;
