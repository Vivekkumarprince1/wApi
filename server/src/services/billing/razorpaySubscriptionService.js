/**
 * Razorpay Subscription Service (Dynamic Order Version)
 * Manages plan upgrades using one-time Orders to bypass Subscription API configuration.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Workspace, Subscription, Plan } = require('../../models');
const walletService = require('./walletService');
const logger = require('../../utils/logger');

class RazorpaySubscriptionService {
  constructor() {
    this.razorpay = null;
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.warn('[RazorpaySubscriptionService] Missing API Keys. Billing features will be disabled.');
    } else {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
    }
  }

  /**
   * Create a dynamic order for a plan upgrade (Bypasses Razorpay Plans API)
   */
  async createSubscription(workspaceId, planId) {
    try {
      if (!workspaceId || !planId) {
        throw new Error('Workspace or Plan context missing.');
      }

      const workspace = await Workspace.findById(workspaceId);
      const plan = await Plan.findById(planId);

      if (!workspace || !plan) {
        throw new Error('Workspace or Plan not found.');
      }

      // 1. Handle Mock Mode
      const isMockMode = !this.razorpay || process.env.MOCK_BILLING === 'true';
      if (isMockMode) {
        return this._generateMockSubscription(workspaceId, plan);
      }

      // 2. Create Dynamic Razorpay Order
      logger.info(`[RazorpaySubscriptionService] Creating dynamic order for plan ${plan.name} (Amount: ${plan.monthlyBaseFeeCents})`);
      
      const receiptId = `plan_${workspaceId.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;
      
      const order = await this.razorpay.orders.create({
        amount: plan.monthlyBaseFeeCents,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          workspaceId: workspaceId.toString(),
          planId: planId.toString(),
          type: 'PLAN_UPGRADE'
        }
      });

      return {
        orderId: order.id,
        amount: order.amount,
        keyId: process.env.RAZORPAY_KEY_ID,
        type: 'ORDER'
      };
    } catch (err) {
      logger.error('[RazorpaySubscriptionService] createSubscription failed:', err.message);
      throw err;
    }
  }

  /**
   * Verify order payment signature and activate plan
   */
  async verifySubscription(workspaceId, paymentData) {
    const { 
      razorpay_payment_id, 
      razorpay_order_id,
      razorpay_subscription_id, // Backward compatibility for legacy subs
      razorpay_signature 
    } = paymentData;

    try {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const idToVerify = razorpay_order_id || razorpay_subscription_id;

      if (!idToVerify) throw new Error('No Order or Subscription ID provided for verification');

      // 1. Verify Signature
      const body = idToVerify + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        throw new Error('Invalid payment signature');
      }

      // 2. Activation
      if (razorpay_order_id) {
        const order = await this.razorpay.orders.fetch(razorpay_order_id);
        const planId = order.notes.planId;
        await this._activatePlan(workspaceId, planId, razorpay_order_id);
      } else {
        // Legacy subscription path
        await this._syncSubscriptionState(razorpay_subscription_id, 'active');
      }

      return { success: true, message: 'Plan activated successfully' };
    } catch (err) {
      logger.error('[RazorpaySubscriptionService] verifySubscription failed:', err.message);
      throw err;
    }
  }

  /**
   * Activate plan manually in DB
   */
  async _activatePlan(workspaceId, planId, providerId) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    await Subscription.findOneAndUpdate(
      { workspace: workspaceId },
      {
        plan: planId,
        status: 'active',
        provider: 'razorpay_order',
        providerSubscriptionId: providerId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: expiryDate,
        lastPaymentAt: new Date()
      },
      { upsert: true, new: true }
    );

    await Workspace.findByIdAndUpdate(workspaceId, {
      plan: planId,
      billingStatus: 'active'
    });

    // Unified History: Record the plan purchase in the wallet history
    try {
      const plan = await Plan.findById(planId);
      if (plan) {
        await walletService.recordPlanPurchase(
          workspaceId, 
          planId, 
          plan.monthlyBaseFeeCents, 
          providerId, 
          plan.name
        );
      }
    } catch (err) {
      logger.error('[RazorpaySubscriptionService] Failed to record transaction history:', err);
    }

    logger.info(`[RazorpaySubscriptionService] Plan ${planId} activated for workspace ${workspaceId}`);
  }

  /**
   * Generate mock response for development
   */
  _generateMockSubscription(workspaceId, plan) {
    const mockId = `mock_order_${crypto.randomBytes(4).toString('hex')}`;
    return {
      orderId: mockId,
      isMock: true,
      amount: plan.monthlyBaseFeeCents,
      type: 'ORDER'
    };
  }

  /**
   * Helper for wallet recharges (unchanged but cleaned up)
   */
  async createRechargeOrder(amountPaise, workspaceId) {
    const receiptId = `rc_${workspaceId.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;
    return this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: { workspaceId: workspaceId.toString(), type: 'WALLET_RECHARGE' }
    });
  }

  /**
   * Legacy sync helper (kept for safety)
   */
  async _syncSubscriptionState(razorpaySubId, status) {
    const subscription = await Subscription.findOne({ providerSubscriptionId: razorpaySubId });
    if (!subscription) return;
    subscription.status = status;
    await subscription.save();
    
    if (status === 'active') {
      await Workspace.findByIdAndUpdate(subscription.workspace, { plan: subscription.plan, billingStatus: 'active' });
    }
  }

  async getSubscriptionStatus(workspaceId) {
    return Subscription.findOne({ workspace: workspaceId }).populate('plan').lean();
  }
}

module.exports = new RazorpaySubscriptionService();
