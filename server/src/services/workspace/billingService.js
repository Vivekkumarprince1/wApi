/**
 * BILLING SERVICE
 * Subscription and payment management
 */

const { Workspace, User } = require('../../models');
const baseRepository = require('../../repositories/baseRepository');
const logger = require('../../utils/logger');
const { createError } = require('../../utils/errorFormatter');

class BillingService {
  constructor() {
    // Payment gateway integration would go here
    this.paymentGateway = process.env.PAYMENT_GATEWAY || 'razorpay';
  }

  /**
   * Create subscription for workspace
   */
  async createSubscription(workspaceId, planId, paymentMethodId, userId) {
    try {
      const workspace = await Workspace.findById(workspaceId).populate('plan');

      if (!workspace) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
      }

      // Check if user has permission
      const member = workspace.members.find(m => m.user._id.toString() === userId);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to manage billing', 403);
      }

      // Create subscription with payment gateway
      const subscriptionData = {
        workspaceId,
        planId,
        paymentMethodId,
        status: 'pending',
        createdAt: new Date()
      };

      // TODO: Integrate with actual payment gateway (Razorpay, Stripe, etc.)
      const subscription = await this.createPaymentGatewaySubscription(subscriptionData);

      workspace.subscription = {
        id: subscription.id,
        planId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cancelAtPeriodEnd: false
      };

      await workspace.save();

      logger.info('Subscription created', { workspaceId, planId, userId });
      return {
        subscription: workspace.subscription,
        clientSecret: subscription.clientSecret // For frontend payment completion
      };
    } catch (error) {
      logger.error('Failed to create subscription', { workspaceId, planId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(workspaceId, updates, userId) {
    try {
      const workspace = await Workspace.findById(workspaceId);

      if (!workspace) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
      }

      // Check permissions
      const member = workspace.members.find(m => m.user._id.toString() === userId);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to manage billing', 403);
      }

      if (!workspace.subscription) {
        throw createError('NO_ACTIVE_SUBSCRIPTION', 'No active subscription found', 400);
      }

      // Update with payment gateway
      await this.updatePaymentGatewaySubscription(workspace.subscription.id, updates);

      workspace.subscription = { ...workspace.subscription, ...updates };
      workspace.updatedAt = new Date();

      await workspace.save();

      logger.info('Subscription updated', { workspaceId, userId, updates });
      return workspace.subscription;
    } catch (error) {
      logger.error('Failed to update subscription', { workspaceId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(workspaceId, cancelAtPeriodEnd = true, userId) {
    try {
      const workspace = await Workspace.findById(workspaceId);

      if (!workspace) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
      }

      // Check permissions
      const member = workspace.members.find(m => m.user._id.toString() === userId);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to manage billing', 403);
      }

      if (!workspace.subscription) {
        throw createError('NO_ACTIVE_SUBSCRIPTION', 'No active subscription found', 400);
      }

      // Cancel with payment gateway
      await this.cancelPaymentGatewaySubscription(workspace.subscription.id, cancelAtPeriodEnd);

      workspace.subscription.status = cancelAtPeriodEnd ? 'canceling' : 'canceled';
      workspace.subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
      if (!cancelAtPeriodEnd) {
        workspace.subscription.canceledAt = new Date();
      }
      workspace.updatedAt = new Date();

      await workspace.save();

      logger.info('Subscription canceled', { workspaceId, userId, cancelAtPeriodEnd });
      return workspace.subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', { workspaceId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(workspaceId, userId, page = 1, limit = 20) {
    try {
      const workspace = await Workspace.findById(workspaceId);

      if (!workspace) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
      }

      // Check permissions
      const member = workspace.members.find(m => m.user._id.toString() === userId);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to view billing', 403);
      }

      // Get billing history from payment gateway
      const history = await this.getPaymentGatewayBillingHistory(workspaceId, page, limit);

      return {
        invoices: history.invoices,
        pagination: {
          page,
          limit,
          total: history.total,
          pages: Math.ceil(history.total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get billing history', { workspaceId, userId, error: error.message });
      throw createError('BILLING_HISTORY_FETCH_FAILED', 'Failed to fetch billing history', 500);
    }
  }

  /**
   * Process webhook from payment gateway
   */
  async processPaymentWebhook(webhookData) {
    try {
      logger.info('Processing payment webhook', { type: webhookData.type });

      switch (webhookData.type) {
        case 'subscription.updated':
          await this.handleSubscriptionUpdate(webhookData.data);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSuccess(webhookData.data);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailure(webhookData.data);
          break;
        case 'subscription.canceled':
          await this.handleSubscriptionCancel(webhookData.data);
          break;
        default:
          logger.warn('Unknown webhook type', { type: webhookData.type });
      }

      return { processed: true };
    } catch (error) {
      logger.error('Failed to process payment webhook', {
        type: webhookData.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if workspace has active subscription
   */
  async hasActiveSubscription(workspaceId) {
    try {
      const workspace = await Workspace.findById(workspaceId).select('subscription');

      if (!workspace || !workspace.subscription) {
        return false;
      }

      const { status, currentPeriodEnd, cancelAtPeriodEnd } = workspace.subscription;

      // Check if subscription is active and not past due
      const isActive = status === 'active' || (status === 'canceling' && !cancelAtPeriodEnd);
      const isCurrent = new Date(currentPeriodEnd) > new Date();

      return isActive && isCurrent;
    } catch (error) {
      logger.error('Failed to check subscription status', { workspaceId, error: error.message });
      return false;
    }
  }

  /**
   * Get current plan limits for workspace
   */
  async getPlanLimits(workspaceId) {
    try {
      const workspace = await Workspace.findById(workspaceId)
        .populate('plan')
        .select('plan subscription');

      if (!workspace) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
      }

      const hasActiveSubscription = await this.hasActiveSubscription(workspaceId);

      if (!hasActiveSubscription) {
        // Return free plan limits
        return {
          messages: 100,
          contacts: 500,
          templates: 10,
          campaigns: 5,
          teamMembers: 3
        };
      }

      return workspace.plan?.limits || {};
    } catch (error) {
      logger.error('Failed to get plan limits', { workspaceId, error: error.message });
      throw createError('PLAN_LIMITS_FETCH_FAILED', 'Failed to fetch plan limits', 500);
    }
  }

  /**
   * Check if workspace can perform action based on limits
   */
  async checkLimit(workspaceId, resource, currentUsage = 0) {
    try {
      const limits = await this.getPlanLimits(workspaceId);
      const limit = limits[resource];

      if (limit === undefined) {
        return { allowed: true }; // No limit set
      }

      const allowed = currentUsage < limit;

      return {
        allowed,
        limit,
        currentUsage,
        remaining: Math.max(0, limit - currentUsage)
      };
    } catch (error) {
      logger.error('Failed to check limit', { workspaceId, resource, error: error.message });
      // Allow action on error to avoid blocking legitimate usage
      return { allowed: true };
    }
  }

  // Payment Gateway Integration Methods (placeholders for actual implementation)

  async createPaymentGatewaySubscription(subscriptionData) {
    // TODO: Implement actual payment gateway integration
    return {
      id: `sub_${Date.now()}`,
      clientSecret: `cs_${Date.now()}`,
      status: 'pending'
    };
  }

  async updatePaymentGatewaySubscription(subscriptionId, updates) {
    // TODO: Implement actual payment gateway integration
    logger.info('Payment gateway subscription update', { subscriptionId, updates });
  }

  async cancelPaymentGatewaySubscription(subscriptionId, cancelAtPeriodEnd) {
    // TODO: Implement actual payment gateway integration
    logger.info('Payment gateway subscription cancel', { subscriptionId, cancelAtPeriodEnd });
  }

  async getPaymentGatewayBillingHistory(workspaceId, page, limit) {
    // TODO: Implement actual payment gateway integration
    return {
      invoices: [],
      total: 0
    };
  }

  // Webhook handlers

  async handleSubscriptionUpdate(data) {
    const workspace = await Workspace.findOne({ 'subscription.id': data.id });
    if (workspace) {
      workspace.subscription = { ...workspace.subscription, ...data };
      await workspace.save();
      logger.info('Subscription updated from webhook', { workspaceId: workspace._id });
    }
  }

  async handlePaymentSuccess(data) {
    // Update payment status, extend subscription period, etc.
    logger.info('Payment succeeded', { invoiceId: data.id });
  }

  async handlePaymentFailure(data) {
    // Handle failed payment - could suspend workspace, send notifications, etc.
    logger.warn('Payment failed', { invoiceId: data.id });
  }

  async handleSubscriptionCancel(data) {
    const workspace = await Workspace.findOne({ 'subscription.id': data.id });
    if (workspace) {
      workspace.subscription.status = 'canceled';
      workspace.subscription.canceledAt = new Date();
      await workspace.save();
      logger.info('Subscription canceled from webhook', { workspaceId: workspace._id });
    }
  }
}

module.exports = new BillingService();