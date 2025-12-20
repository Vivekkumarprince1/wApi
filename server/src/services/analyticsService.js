const Message = require('../models/Message');
const Workspace = require('../models/Workspace');

async function aggregateDailyStats() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday.setHours(0, 0, 0, 0));
  const end = new Date(yesterday.setHours(23, 59, 59, 999));
  // aggregate per workspace
  const stats = await Message.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: { workspace: '$workspace', status: '$status' }, count: { $sum: 1 } } }
  ]);
  // persist these stats somewhere or push to a metrics store (placeholder)
  console.log('Daily stats aggregated', stats.length);
  return stats;
}

module.exports = { aggregateDailyStats };
