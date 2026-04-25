const { Plan } = require('../../models');
const logger = require('../../utils/logger');
const razorpayService = require('../../services/billing/razorpaySubscriptionService');

/**
 * Get all available plans
 */
async function getAllPlans(req, res, next) {
  try {
    const plans = await Plan.find().sort({ monthlyBaseFeeCents: 1 });
    res.json({
      success: true,
      data: plans
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new subscription plan
 */
async function createPlan(req, res, next) {
  try {
    const { 
      name, 
      slug, 
      monthlyBaseFeeCents, 
      currency, 
      features,
      limits, 
      conversationPricing,
      fixedPricePaise
    } = req.body;

    const trimmedName = name.trim();
    const trimmedSlug = slug ? slug.trim() : trimmedName.toLowerCase().replace(/\s+/g, '-');

    const plan = await Plan.create({
      name: trimmedName,
      slug: trimmedSlug,
      monthlyBaseFeeCents,
      currency,
      features: features || [],
      limits,
      conversationPricing,
      fixedPricePaise
    });
 
    res.status(201).json({
      success: true,
      data: plan
    });
  } catch (err) {
    logger.error('[PlanController] createPlan failed:', err.message);
    next(err);
  }
}

/**
 * Update an existing plan
 */
async function updatePlan(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await Plan.findByIdAndUpdate(id, updates, { new: true });
    
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
 
    res.json({
      success: true,
      data: plan
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a plan (Soft delete by default, Permanent if force=true)
 */
async function deletePlan(req, res, next) {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const { Workspace } = require('../../models');

    // Safety Check: Check if any workspace is using this plan
    const workspaceCount = await Workspace.countDocuments({ plan: id });
    
    if (workspaceCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete plan: it is currently assigned to ${workspaceCount} workspace(s). Please migrate those workspaces to a different plan first.`,
        code: 'PLAN_IN_USE',
        usageCount: workspaceCount
      });
    }

    if (force === 'true') {
      const deletedPlan = await Plan.findByIdAndDelete(id);
      
      if (!deletedPlan) {
        return res.status(404).json({ success: false, message: 'Plan not found' });
      }

      logger.info(`[PlanController] Plan ${id} permanently deleted by admin ${req.user.email}`);

      return res.json({
        success: true,
        message: 'Plan permanently deleted from database',
        data: deletedPlan
      });
    } else {
      // Standard Deactivation (Soft Delete)
      const deactivatedPlan = await Plan.findByIdAndUpdate(id, { isActive: false }, { new: true });
      
      if (!deactivatedPlan) {
        return res.status(404).json({ success: false, message: 'Plan not found' });
      }

      logger.info(`[PlanController] Plan ${id} deactivated by admin ${req.user.email}`);

      return res.json({
        success: true,
        message: 'Plan deactivated successfully (Soft Deleted)',
        data: deactivatedPlan
      });
    }
  } catch (err) {
    logger.error('[PlanController] deletePlan failed:', err.message);
    next(err);
  }
}

module.exports = {
  getAllPlans,
  createPlan,
  updatePlan,
  deletePlan
};
