/**
 * Feature Gate Middleware
 * Blocks access to routes based on the Workspace's Subscription Plan
 */

const { Workspace } = require('../../models');

/**
 * Check if the current workspace has access to a specific feature
 * @param {String} featureKey - The key of the feature to check (e.g. 'CRM', 'ANSWERBOT')
 */
function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.workspace) {
        return res.status(401).json({
          success: false,
          message: 'Workspace context missing',
          code: 'AUTH_REQUIRED'
        });
      }

      // Fetch workspace without population first to avoid CastError on invalid plan IDs
      let workspace = await Workspace.findById(req.user.workspace).lean();

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
          code: 'WORKSPACE_NOT_FOUND'
        });
      }

      // Manual validation and population of plan to avoid Mongoose crashes on legacy data
      let plan = null;
      const planId = workspace.plan;

      // Check if planId is a valid Mongo ObjectId
      const isValidObjectId = (id) => id && /^[0-9a-fA-F]{24}$/.test(id.toString());

      if (isValidObjectId(planId)) {
        const { Plan } = require('../../models');
        plan = await Plan.findById(planId).lean();
      } 
      
      // Fallback: If no valid plan is found in DB, use the official 'Starter' plan as baseline
      if (!plan) {
        const { Plan } = require('../../models');
        plan = await Plan.findOne({ slug: 'starter' }).lean();
        
        if (plan) {
          console.log(`[FeatureGate] Workspace ${workspace._id} using dynamic 'Starter' fallback permissions`);
        } else {
          // Hard fallback if even Starter plan is missing from DB (should not happen if seeded)
          console.warn(`[FeatureGate] Workspace ${workspace._id} using hardcoded fallback (Starter plan missing from DB)`);
          plan = {
            name: 'Starter (Limited)',
            // Ensure this list mirrors the baseline needed for the app to function
            features: [
                'CRM', 'ANALYTICS', 'CONTACTS', 'BULK_CAMPAIGN', 'TEMPLATES', 
                'INBOX', 'TEAM', 'WIDGET', 'INTEGRATIONS', 'COMMERCE', 'WHATSAPP_FORMS'
            ] 
          };
        }
      }

      // Check if plan exists and contains the feature
      const featuresToCheck = Array.isArray(featureKey) ? featureKey : [featureKey];
      const hasFeature = plan && plan.features && featuresToCheck.some(f => plan.features.includes(f));

      if (!hasFeature) {
        // Log reason for audit visibility
        if (!plan) console.warn(`[FeatureGate] Access denied for ${featureKey}: No valid plan found for workspace ${workspace._id}`);
        
        return res.status(402).json({
          success: false,
          message: `Your current plan does not include the ${featureKey} feature. Please upgrade to unlock.`,
          code: 'FEATURE_LOCKED',
          requiredFeature: featureKey,
          currentPlan: plan ? plan.name : 'Starter (Limited)'
        });
      }

      // Attach populated objects for downstream usage
      req.workspace = { ...workspace, plan };
      next();
    } catch (err) {
      console.error('[FeatureGate] Error:', err.message);
      res.status(500).json({
        success: false,
        message: 'Feature access check failed',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

module.exports = { requireFeature };
