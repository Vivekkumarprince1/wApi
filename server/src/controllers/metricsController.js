const Message = require('../models/Message');
const Template = require('../models/Template');

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
    const sent = await Message.countDocuments({ workspace, status: 'sent' });
    const delivered = await Message.countDocuments({ workspace, status: 'delivered' });
    const read = await Message.countDocuments({ workspace, status: 'read' });
    const failed = await Message.countDocuments({ workspace, status: 'failed' });
    
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
    
    res.json({
      total,
      byStatus: {
        sent,
        delivered,
        read,
        failed
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
