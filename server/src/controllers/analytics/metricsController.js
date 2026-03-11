const { Message, Template, Workspace } = require('../../models');
const { getQueueStats } = require('../../services/infrastructure/messageRetryQueue');
const { resolveWhatsAppWebhookUrl } = require('../../services/bsp/gupshupProvisioningService');

const COUNTRY_CODES = [
  { code: '1', country: 'US/CA' },
  { code: '7', country: 'RU/KZ' },
  { code: '20', country: 'EG' },
  { code: '27', country: 'ZA' },
  { code: '30', country: 'GR' },
  { code: '31', country: 'NL' },
  { code: '32', country: 'BE' },
  { code: '33', country: 'FR' },
  { code: '34', country: 'ES' },
  { code: '39', country: 'IT' },
  { code: '44', country: 'UK' },
  { code: '49', country: 'DE' },
  { code: '52', country: 'MX' },
  { code: '55', country: 'BR' },
  { code: '60', country: 'MY' },
  { code: '61', country: 'AU' },
  { code: '62', country: 'ID' },
  { code: '63', country: 'PH' },
  { code: '65', country: 'SG' },
  { code: '66', country: 'TH' },
  { code: '81', country: 'JP' },
  { code: '82', country: 'KR' },
  { code: '84', country: 'VN' },
  { code: '86', country: 'CN' },
  { code: '90', country: 'TR' },
  { code: '91', country: 'IN' },
  { code: '92', country: 'PK' },
  { code: '93', country: 'AF' },
  { code: '94', country: 'LK' },
  { code: '95', country: 'MM' },
  { code: '98', country: 'IR' }
].sort((left, right) => right.code.length - left.code.length);

function detectCountryFromPhone(phone) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) return 'Unknown';

  const match = COUNTRY_CODES.find((entry) => normalized.startsWith(entry.code));
  return match ? match.country : 'Other';
}

async function buildDeliveryHealth(workspace, since) {
  const recentOutbound = await Message.find({
    workspace,
    direction: 'outbound',
    createdAt: { $gte: since }
  }).select('recipientPhone status type failureReason createdAt meta').lean();

  const byCountry = recentOutbound.reduce((acc, item) => {
    const country = detectCountryFromPhone(item.recipientPhone);
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});

  const byType = recentOutbound.reduce((acc, item) => {
    const messageType = item.type || 'unknown';
    acc[messageType] = (acc[messageType] || 0) + 1;
    return acc;
  }, {});

  const stuckQueued = recentOutbound.filter((item) => {
    if (item.status !== 'queued') return false;
    const ageMs = Date.now() - new Date(item.createdAt).getTime();
    return ageMs > 5 * 60 * 1000;
  }).length;

  const topFailures = Object.entries(
    recentOutbound
      .filter((item) => item.status === 'failed' && item.failureReason)
      .reduce((acc, item) => {
        acc[item.failureReason] = (acc[item.failureReason] || 0) + 1;
        return acc;
      }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  const queueStats = await getQueueStats().catch((error) => ({ error: error.message }));
  const workspaceDoc = await Workspace.findById(workspace)
    .select('bspManaged bspPhoneNumberId gupshupIdentity gupshupAppId whatsappConnected wabaStatus metaAccountStatus')
    .lean();

  const webhookUrl = resolveWhatsAppWebhookUrl();
  const webhookConfigured = Boolean(webhookUrl && /^https:\/\//i.test(webhookUrl));

  return {
    byCountry,
    byType,
    topFailures,
    stuckQueued,
    queueStats,
    providerChecks: {
      bspManaged: Boolean(workspaceDoc?.bspManaged),
      whatsappConnected: Boolean(workspaceDoc?.whatsappConnected),
      partnerAppIdPresent: Boolean(workspaceDoc?.gupshupIdentity?.partnerAppId || workspaceDoc?.gupshupAppId),
      appApiKeyPresent: Boolean(workspaceDoc?.gupshupIdentity?.appApiKey),
      phoneNumberIdPresent: Boolean(workspaceDoc?.bspPhoneNumberId),
      businessVerified: ['VERIFIED', 'APPROVED', 'LIVE'].includes(String(workspaceDoc?.wabaStatus || workspaceDoc?.metaAccountStatus || '').toUpperCase()),
      webhookConfigured,
      webhookUrl: webhookConfigured ? webhookUrl : null
    }
  };
}

// Get template metrics
async function getTemplateMetrics(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { days = 30 } = req.query;
    
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    
    // Overall counts
    const total = await Template.countDocuments({ workspace });
    const approved = await Template.countDocuments({ workspace, status: 'APPROVED' });
    const pending = await Template.countDocuments({ workspace, status: 'PENDING' });
    const rejected = await Template.countDocuments({ workspace, status: 'REJECTED' });
    const draft = await Template.countDocuments({ workspace, status: 'DRAFT' });
    
    // Recent submissions
    const recentSubmissions = await Template.countDocuments({
      workspace,
      submittedAt: { $gte: since }
    });
    
    // Recent approvals
    const recentApprovals = await Template.countDocuments({
      workspace,
      status: 'APPROVED',
      approvedAt: { $gte: since }
    });
    
    // Recent rejections
    const recentRejections = await Template.countDocuments({
      workspace,
      status: 'REJECTED',
      updatedAt: { $gte: since }
    });
    
    // Quality scores
    const qualityScores = await Template.aggregate([
      { $match: { workspace, status: 'APPROVED' } },
      { $group: { _id: '$qualityScore', count: { $sum: 1 } } }
    ]);
    
    res.json({
      total,
      byStatus: {
        approved,
        pending,
        rejected,
        draft
      },
      recent: {
        submissions: recentSubmissions,
        approvals: recentApprovals,
        rejections: recentRejections
      },
      qualityScores: qualityScores.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (err) {
    next(err);
  }
}

// Get message metrics
async function getMessageMetrics(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { days = 7 } = req.query;
    
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    
    // Total counts
    const total = await Message.countDocuments({ workspace });
    const totalOutbound = await Message.countDocuments({ workspace, direction: 'outbound' });
    const sent = await Message.countDocuments({ workspace, status: 'sent' });
    const delivered = await Message.countDocuments({ workspace, status: 'delivered' });
    const read = await Message.countDocuments({ workspace, status: 'read' });
    const failed = await Message.countDocuments({ workspace, status: 'failed' });
    const queued = await Message.countDocuments({ workspace, status: 'queued' });
    const unknown = await Message.countDocuments({ workspace, status: 'unknown' });
    
    // Recent counts
    const recentTotal = await Message.countDocuments({
      workspace,
      createdAt: { $gte: since }
    });
    
    // By direction
    const inbound = await Message.countDocuments({ workspace, direction: 'inbound' });
    const outbound = await Message.countDocuments({ workspace, direction: 'outbound' });
    
    // By day (last N days)
    const byDay = await Message.aggregate([
      { $match: { workspace, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            direction: '$direction'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.day': 1 } }
    ]);
    
    // By status (recent)
    const recentByStatus = await Message.aggregate([
      { $match: { workspace, createdAt: { $gte: since } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const deliveryHealth = await buildDeliveryHealth(workspace, since);
    const accepted = queued + sent + delivered + read;
    const confirmedDelivered = delivered + read;
    const deliveryRate = accepted > 0 ? Math.round((confirmedDelivered / accepted) * 100) : 0;
    const failureRate = accepted > 0 ? Math.round((failed / accepted) * 100) : 0;
    
    res.json({
      total,
      totalOutbound,
      byStatus: {
        queued,
        sent,
        delivered,
        read,
        failed,
        unknown
      },
      deliveryHealth: {
        accepted,
        confirmedDelivered,
        deliveryRate,
        failureRate,
        ...deliveryHealth
      },
      byDirection: {
        inbound,
        outbound
      },
      recent: {
        total: recentTotal,
        byDay: byDay.map(item => ({
          date: item._id.day,
          direction: item._id.direction,
          count: item.count
        })),
        byStatus: recentByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTemplateMetrics,
  getMessageMetrics
};
