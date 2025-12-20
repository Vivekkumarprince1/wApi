const Message = require('../models/Message');

async function getDailyStats(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
    const stats = await Message.aggregate([
      { $match: { workspace: workspace, createdAt: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, status: '$status' }, count: { $sum: 1 } } }
    ]);
    res.json(stats);
  } catch (err) { next(err); }
}

module.exports = { getDailyStats };
