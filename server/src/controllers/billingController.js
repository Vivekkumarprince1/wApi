const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const UsageLedger = require('../models/UsageLedger');
const Invoice = require('../models/Invoice');
const Workspace = require('../models/Workspace');
const { getBillingPeriod, getOrCreateUsageLedger } = require('../services/usageLedgerService');

async function getUsage(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const ledger = await getOrCreateUsageLedger(workspaceId);

    res.json({
      success: true,
      data: ledger
    });
  } catch (err) {
    next(err);
  }
}

async function getEstimate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const ledger = await getOrCreateUsageLedger(workspaceId);

    const subscription = await Subscription.findOne({ workspace: workspaceId })
      .sort({ createdAt: -1 })
      .populate('plan')
      .lean();

    const plan = subscription?.plan || null;
    const baseFeeCents = plan?.monthlyBaseFeeCents || 0;
    const passThroughCents = ledger?.metaUsage?.metaAmountCents || 0;

    res.json({
      success: true,
      data: {
        billingPeriod: ledger.billingPeriod,
        baseFeeCents,
        passThroughCents,
        estimatedTotalCents: baseFeeCents + passThroughCents,
        currency: plan?.currency || ledger?.metaUsage?.metaCurrency || 'USD'
      }
    });
  } catch (err) {
    next(err);
  }
}

async function listInvoices(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const invoices = await Invoice.find({ workspace: workspaceId })
      .sort({ issuedAt: -1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: invoices });
  } catch (err) {
    next(err);
  }
}

async function getInvoice(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const invoice = await Invoice.findOne({ _id: req.params.id, workspace: workspaceId }).lean();

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

async function upgradePlan(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { planId, planSlug } = req.body;

    const plan = planId
      ? await Plan.findById(planId)
      : await Plan.findOne({ slug: planSlug });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const now = new Date();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

    const subscription = await Subscription.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          plan: plan._id,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false
        },
        $setOnInsert: {
          workspace: workspaceId,
          trialStart: now,
          trialEnd: null
        }
      },
      { upsert: true, new: true }
    );

    await Workspace.findByIdAndUpdate(workspaceId, {
      $set: {
        billingStatus: 'active',
        plan: plan.slug
      }
    });

    res.json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
}

async function suspendWorkspace(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { reason = 'Self-suspended' } = req.body;

    const subscription = await Subscription.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          status: 'suspended',
          suspendedAt: new Date(),
          suspensionReason: reason
        }
      },
      { new: true }
    );

    await Workspace.findByIdAndUpdate(workspaceId, {
      $set: { billingStatus: 'suspended', suspensionReason: reason }
    });

    res.json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsage,
  getEstimate,
  listInvoices,
  getInvoice,
  upgradePlan,
  suspendWorkspace
};
