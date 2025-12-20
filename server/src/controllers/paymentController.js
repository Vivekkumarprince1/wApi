const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

// Lazy initialize Razorpay instance
let razorpay = null;

function getRazorpayInstance() {
  if (!razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpay;
}

// Plan configurations
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    limits: {
      maxContacts: 100,
      maxMessages: 1000,
      maxTemplates: 10,
      maxCampaigns: 5,
      maxAutomations: 3
    }
  },
  basic: {
    name: 'Basic',
    price: 999, // in INR
    limits: {
      maxContacts: 1000,
      maxMessages: 10000,
      maxTemplates: 50,
      maxCampaigns: 20,
      maxAutomations: 10
    }
  },
  premium: {
    name: 'Premium',
    price: 2999,
    limits: {
      maxContacts: 10000,
      maxMessages: 100000,
      maxTemplates: 200,
      maxCampaigns: 100,
      maxAutomations: 50
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 9999,
    limits: {
      maxContacts: -1, // unlimited
      maxMessages: -1,
      maxTemplates: -1,
      maxCampaigns: -1,
      maxAutomations: -1
    }
  }
};

// Get available plans
async function getPlans(req, res, next) {
  try {
    res.json({
      success: true,
      plans: PLANS
    });
  } catch (err) {
    next(err);
  }
}

// Create Razorpay order
async function createOrder(req, res, next) {
  try {
    const { plan } = req.body;
    
    if (!PLANS[plan]) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid plan selected' 
      });
    }
    
    if (plan === 'free') {
      return res.status(400).json({ 
        success: false, 
        message: 'Free plan does not require payment' 
      });
    }
    
    const razorpayInstance = getRazorpayInstance();
    if (!razorpayInstance) {
      return res.status(500).json({ 
        success: false, 
        message: 'Payment gateway not configured' 
      });
    }
    
    const amount = PLANS[plan].price * 100; // Convert to paise
    
    const options = {
      amount,
      currency: 'INR',
      receipt: `order_${req.user._id}_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        workspaceId: req.user.workspace.toString(),
        plan
      }
    };
    
    const order = await razorpayInstance.orders.create(options);
    
    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        plan,
        key_id: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (err) {
    next(err);
  }
}

// Verify payment and update subscription
async function verifyPayment(req, res, next) {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      plan 
    } = req.body;
    
    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment signature' 
      });
    }
    
    // Payment verified, update workspace
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ 
        success: false, 
        message: 'Workspace not found' 
      });
    }
    
    // Update plan and limits
    workspace.plan = plan;
    workspace.planLimits = PLANS[plan].limits;
    workspace.subscription = {
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      autoRenew: true,
      razorpaySubscriptionId: razorpay_payment_id
    };
    
    await workspace.save();
    
    res.json({
      success: true,
      message: 'Payment verified and subscription updated',
      workspace
    });
  } catch (err) {
    next(err);
  }
}

// Get current subscription
async function getSubscription(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ 
        success: false, 
        message: 'Workspace not found' 
      });
    }
    
    res.json({
      success: true,
      subscription: {
        plan: workspace.plan,
        limits: workspace.planLimits,
        usage: workspace.usage,
        subscription: workspace.subscription
      }
    });
  } catch (err) {
    next(err);
  }
}

// Cancel subscription
async function cancelSubscription(req, res, next) {
  try {
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ 
        success: false, 
        message: 'Workspace not found' 
      });
    }
    
    // Update subscription status
    workspace.subscription.status = 'cancelled';
    workspace.subscription.autoRenew = false;
    
    await workspace.save();
    
    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      workspace
    });
  } catch (err) {
    next(err);
  }
}

// Webhook handler for Razorpay events
async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid webhook signature' 
      });
    }
    
    const event = req.body.event;
    const payload = req.body.payload;
    
    // Handle different events
    switch (event) {
      case 'payment.captured':
        // Payment successful
        console.log('Payment captured:', payload.payment.entity.id);
        break;
        
      case 'payment.failed':
        // Payment failed
        console.log('Payment failed:', payload.payment.entity.id);
        break;
        
      case 'subscription.cancelled':
        // Subscription cancelled
        console.log('Subscription cancelled:', payload.subscription.entity.id);
        break;
        
      default:
        console.log('Unhandled event:', event);
    }
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Update billing information
async function updateBillingInfo(req, res, next) {
  try {
    const { email, phone, address } = req.body;
    
    const workspace = await Workspace.findById(req.user.workspace);
    
    if (!workspace) {
      return res.status(404).json({ 
        success: false, 
        message: 'Workspace not found' 
      });
    }
    
    workspace.billingInfo = {
      email: email || workspace.billingInfo?.email,
      phone: phone || workspace.billingInfo?.phone,
      address: address || workspace.billingInfo?.address
    };
    
    await workspace.save();
    
    res.json({
      success: true,
      message: 'Billing information updated',
      billingInfo: workspace.billingInfo
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPlans,
  createOrder,
  verifyPayment,
  getSubscription,
  cancelSubscription,
  handleWebhook,
  updateBillingInfo
};
