const express = require('express');
const razorpaySubscriptionService = require('../../services/billing/razorpaySubscriptionService');
const auth = require('../../middlewares/auth');

const router = express.Router();

router.use(auth);

/**
 * GET /api/v1/billing/subscriptions/status
 * Get the current active subscription and plan for the workspace
 */
router.get('/status', async (req, res, next) => {
  try {
    const workspaceId = req.user.workspace;
    const status = await razorpaySubscriptionService.getSubscriptionStatus(workspaceId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/billing/subscriptions/create
 * Create a new Razorpay subscription and return the payment link
 */
router.post('/create', async (req, res, next) => {
  try {
    const { planId, billingCycle } = req.body;
    const workspaceId = req.user.workspace;

    const result = await razorpaySubscriptionService.createSubscription(
      workspaceId, 
      planId, 
      billingCycle
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[SubscriptionCreate] Error:', err);
    
    // Safely extract error message
    const errorMessage = err.message || (err.error && err.error.description) || 'Internal server error during subscription creation';
    
    // Return specific error messages for known failures
    if (errorMessage.toLowerCase().includes('not found')) {
      return res.status(404).json({ success: false, message: errorMessage });
    }
    
    if (errorMessage.toLowerCase().includes('configuration') || errorMessage.toLowerCase().includes('placeholder')) {
      return res.status(400).json({ success: false, message: errorMessage });
    }

    res.status(err.statusCode || 500).json({ 
      success: false, 
      message: errorMessage
    });
  }
});

/**
 * POST /api/v1/billing/subscriptions/verify
 * Verify payment signature and activate subscription
 */
router.post('/verify', async (req, res, next) => {
  try {
    const workspaceId = req.user.workspace;
    const result = await razorpaySubscriptionService.verifySubscription(workspaceId, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/billing/subscriptions/simulate-success
 * DEV ONLY: Manually activate a mock subscription
 */
router.post('/simulate-success', async (req, res, next) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId.startsWith('sub_mock_')) {
      return res.status(400).json({ success: false, message: 'Only mock subscriptions can be simulated' });
    }

    const { Plan, Workspace, Subscription } = require('../../models');
    const sub = await Subscription.findOne({ providerSubscriptionId: subscriptionId });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    // Manually trigger the sync logic
    await razorpaySubscriptionService._syncSubscriptionState(subscriptionId, 'active');

    res.json({ success: true, message: 'Mock subscription activated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
