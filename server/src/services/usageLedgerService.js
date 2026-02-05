const UsageLedger = require('../models/UsageLedger');
const Workspace = require('../models/Workspace');

function getBillingPeriod(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  const billingPeriod = `${year}-${String(month + 1).padStart(2, '0')}`;

  return { billingPeriod, periodStart, periodEnd };
}

function getPeriodBoundsFromKey(billingPeriod) {
  const [yearStr, monthStr] = String(billingPeriod || '').split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return getBillingPeriod();
  }

  const periodStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

  return { periodStart, periodEnd };
}

async function getOrCreateUsageLedger(workspaceId, date = new Date()) {
  const { billingPeriod, periodStart, periodEnd } = getBillingPeriod(date);

  return UsageLedger.findOneAndUpdate(
    { workspace: workspaceId, billingPeriod },
    {
      $setOnInsert: {
        workspace: workspaceId,
        billingPeriod,
        periodStart,
        periodEnd
      }
    },
    { new: true, upsert: true }
  );
}

async function incrementConversations({ workspaceId, category, initiatedBy }) {
  const { billingPeriod, periodStart, periodEnd } = getBillingPeriod();
  const normalizedCategory = category?.toLowerCase();

  const update = {
    $inc: {}
  };

  if (normalizedCategory) {
    update.$inc[`conversations.${normalizedCategory}`] = 1;
  }

  if (initiatedBy === 'BUSINESS') {
    update.$inc['conversations.businessInitiated'] = 1;
  }

  if (initiatedBy === 'USER') {
    update.$inc['conversations.userInitiated'] = 1;
  }

  return UsageLedger.findOneAndUpdate(
    { workspace: workspaceId, billingPeriod },
    {
      ...update,
      $setOnInsert: {
        workspace: workspaceId,
        billingPeriod,
        periodStart,
        periodEnd
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function incrementMessages({ workspaceId, direction }) {
  const { billingPeriod, periodStart, periodEnd } = getBillingPeriod();
  const messageField = direction === 'inbound' ? 'messages.inbound' : 'messages.outbound';

  return UsageLedger.findOneAndUpdate(
    { workspace: workspaceId, billingPeriod },
    {
      $inc: { [messageField]: 1 },
      $setOnInsert: {
        workspace: workspaceId,
        billingPeriod,
        periodStart,
        periodEnd
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function incrementTemplateSubmissions(workspaceId, count = 1) {
  const { billingPeriod, periodStart, periodEnd } = getBillingPeriod();

  return UsageLedger.findOneAndUpdate(
    { workspace: workspaceId, billingPeriod },
    {
      $inc: { templateSubmissions: count },
      $setOnInsert: {
        workspace: workspaceId,
        billingPeriod,
        periodStart,
        periodEnd
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function snapshotActivePhones(date = new Date()) {
  const { billingPeriod, periodStart, periodEnd } = getBillingPeriod(date);

  const workspaces = await Workspace.find({ bspManaged: true })
    .select('_id bspPhoneStatus activePhoneNumberId bspPhoneNumberId whatsappPhoneNumberId')
    .lean();

  const updates = workspaces.map(async (workspace) => {
    const activePhoneId = workspace.activePhoneNumberId || workspace.bspPhoneNumberId || workspace.whatsappPhoneNumberId;
    const isActive = workspace.bspPhoneStatus === 'CONNECTED' && !!activePhoneId;

    return UsageLedger.findOneAndUpdate(
      { workspace: workspace._id, billingPeriod },
      {
        $setOnInsert: {
          workspace: workspace._id,
          billingPeriod,
          periodStart,
          periodEnd
        },
        $set: {
          'activePhones.count': isActive ? 1 : 0,
          'activePhones.phoneNumberIds': isActive ? [activePhoneId] : []
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });

  await Promise.all(updates);
}

async function upsertMetaUsage({
  workspaceId,
  billingPeriod,
  metaInvoiceId,
  metaAmountCents,
  metaCurrency,
  metaConversations
}) {
  const { periodStart, periodEnd } = getPeriodBoundsFromKey(billingPeriod);

  return UsageLedger.findOneAndUpdate(
    { workspace: workspaceId, billingPeriod },
    {
      $setOnInsert: {
        workspace: workspaceId,
        billingPeriod,
        periodStart,
        periodEnd
      },
      $set: {
        'metaUsage.metaInvoiceId': metaInvoiceId,
        'metaUsage.metaAmountCents': metaAmountCents,
        'metaUsage.metaCurrency': metaCurrency,
        'metaUsage.metaConversations': metaConversations || {}
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  getBillingPeriod,
  getOrCreateUsageLedger,
  incrementConversations,
  incrementMessages,
  incrementTemplateSubmissions,
  snapshotActivePhones,
  upsertMetaUsage
};
