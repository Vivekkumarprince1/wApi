const Deal = require('../models/Deal');
const Pipeline = require('../models/Pipeline');
const mongoose = require('mongoose');

/**
 * Pipeline Performance Report
 * - Total deals per pipeline
 * - Deals per stage
 * - Conversion rates (open → won / lost)
 */
async function getPipelinePerformance(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { pipelineId, startDate, endDate } = req.query;

    // Build filter
    const matchStage = {
      workspace: workspace
    };

    if (pipelineId) {
      matchStage.pipeline = mongoose.Types.ObjectId.isValid(pipelineId) ? new mongoose.Types.ObjectId(pipelineId) : pipelineId;
    }

    // Date range filter
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Get pipeline performance data
    const results = await Deal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$pipeline',
          totalDeals: { $sum: 1 },
          wonDeals: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          lostDeals: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
          activeDeals: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalValue: { $sum: '$value' },
          avgValue: { $avg: '$value' }
        }
      },
      {
        $lookup: {
          from: 'pipelines',
          localField: '_id',
          foreignField: '_id',
          as: 'pipeline'
        }
      },
      { $unwind: { path: '$pipeline', preserveNullAndEmptyArrays: true } }
    ]);

    // Calculate conversion rates
    const data = results.map((result) => ({
      pipelineId: result._id,
      pipelineName: result.pipeline?.name || 'Unknown',
      totalDeals: result.totalDeals,
      wonDeals: result.wonDeals,
      lostDeals: result.lostDeals,
      activeDeals: result.activeDeals,
      totalValue: Math.round(result.totalValue || 0),
      avgValue: Math.round(result.avgValue || 0),
      conversionRate: result.totalDeals > 0 ? Math.round((result.wonDeals / result.totalDeals) * 100) : 0,
      closureRate: result.totalDeals > 0 ? Math.round(((result.wonDeals + result.lostDeals) / result.totalDeals) * 100) : 0
    }));

    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Funnel Report
 * - Stage-to-stage drop-off
 * - Conversion percentages
 * - Deal counts per stage
 */
async function getFunnelReport(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { pipelineId, startDate, endDate } = req.query;

    if (!pipelineId) {
      return res.status(400).json({ message: 'pipelineId is required for funnel report' });
    }

    // Get pipeline to know all stages
    const pipeline = await Pipeline.findOne({
      _id: pipelineId,
      workspace
    });

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    // Build filter
    const matchStage = {
      workspace: workspace,
      pipeline: mongoose.Types.ObjectId.isValid(pipelineId) ? new mongoose.Types.ObjectId(pipelineId) : pipelineId
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Get deals per stage
    const dealsPerStage = await Deal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          value: { $sum: '$value' }
        }
      }
    ]);

    // Build funnel with all stages
    const stageMap = {};
    dealsPerStage.forEach((stage) => {
      stageMap[stage._id] = { count: stage.count, value: stage.value };
    });

    const funnel = pipeline.stages
      .sort((a, b) => a.position - b.position)
      .map((stage, index) => {
        const stageData = stageMap[stage.id] || { count: 0, value: 0 };
        const prevStageTotalDeals = index === 0 ? stageData.count : dealsPerStage[index - 1]?.count || stageData.count;

        return {
          stageId: stage.id,
          stageName: stage.title,
          dealCount: stageData.count,
          totalValue: stageData.value,
          dropoff: index > 0 ? Math.round((1 - stageData.count / prevStageTotalDeals) * 100) : 0,
          conversionFromPrev: index > 0 ? Math.round((stageData.count / prevStageTotalDeals) * 100) : 100
        };
      });

    res.json({
      success: true,
      pipelineName: pipeline.name,
      funnel,
      totalDeals: dealsPerStage.reduce((sum, s) => sum + s.count, 0),
      totalValue: dealsPerStage.reduce((sum, s) => sum + s.value, 0)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Agent Performance Report
 * - Deals assigned per agent
 * - Deals won per agent
 * - Win rate per agent
 * - Avg deal duration
 */
async function getAgentPerformance(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { agentId, startDate, endDate } = req.query;

    // Build filter
    const matchStage = {
      workspace: workspace,
      assignedAgent: { $exists: true, $ne: null } // Only deals with assigned agents
    };

    if (agentId) {
      matchStage.assignedAgent = mongoose.Types.ObjectId.isValid(agentId) ? new mongoose.Types.ObjectId(agentId) : agentId;
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Get agent performance data
    const results = await Deal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$assignedAgent',
          totalDeals: { $sum: 1 },
          wonDeals: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          lostDeals: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
          activeDeals: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalValue: { $sum: '$value' },
          avgDuration: {
            $avg: {
              $cond: [
                { $ne: ['$closedAt', null] },
                { $divide: [{ $subtract: ['$closedAt', '$createdAt'] }, 1000 * 60 * 60 * 24] }, // Convert ms to days
                null
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      { $sort: { totalDeals: -1 } }
    ]);

    // Format response
    const data = results.map((result) => ({
      agentId: result._id,
      agentName: result.agent?.name || 'Unknown',
      agentEmail: result.agent?.email || '',
      totalDeals: result.totalDeals,
      wonDeals: result.wonDeals,
      lostDeals: result.lostDeals,
      activeDeals: result.activeDeals,
      totalValue: Math.round(result.totalValue || 0),
      winRate: result.totalDeals > 0 ? Math.round((result.wonDeals / result.totalDeals) * 100) : 0,
      avgDuration: result.avgDuration ? Math.round(result.avgDuration) : 0 // in days
    }));

    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Deal Velocity Report
 * - Avg time to close
 * - Fastest & slowest deals
 * - Trend over time (optional)
 * - Median duration
 */
async function getDealVelocity(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { pipelineId, startDate, endDate } = req.query;

    // Build filter for closed deals
    const matchStage = {
      workspace: workspace,
      status: { $in: ['won', 'lost'] }, // Only closed deals
      closedAt: { $exists: true, $ne: null }
    };

    if (pipelineId) {
      matchStage.pipeline = mongoose.Types.ObjectId.isValid(pipelineId) ? new mongoose.Types.ObjectId(pipelineId) : pipelineId;
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Get all closed deals with duration
    const closedDeals = await Deal.aggregate([
      { $match: matchStage },
      {
        $project: {
          title: 1,
          status: 1,
          value: 1,
          createdAt: 1,
          closedAt: 1,
          duration: {
            $divide: [{ $subtract: ['$closedAt', '$createdAt'] }, 1000 * 60 * 60 * 24] // Convert ms to days
          }
        }
      },
      { $sort: { duration: 1 } }
    ]);

    if (closedDeals.length === 0) {
      return res.json({
        success: true,
        avgDuration: 0,
        medianDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        deals: [],
        count: 0
      });
    }

    // Calculate statistics
    const durations = closedDeals.map((d) => d.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const medianDuration =
      sortedDurations.length % 2 === 0
        ? (sortedDurations[sortedDurations.length / 2 - 1] + sortedDurations[sortedDurations.length / 2]) / 2
        : sortedDurations[Math.floor(sortedDurations.length / 2)];

    // Get fastest and slowest (top 5)
    const fastest = closedDeals.slice(0, 5);
    const slowest = closedDeals.slice(-5).reverse();

    res.json({
      success: true,
      avgDuration: Math.round(avgDuration),
      medianDuration: Math.round(medianDuration),
      minDuration: Math.round(Math.min(...durations)),
      maxDuration: Math.round(Math.max(...durations)),
      fastest: fastest.map((d) => ({
        title: d.title,
        duration: Math.round(d.duration),
        status: d.status,
        value: d.value
      })),
      slowest: slowest.map((d) => ({
        title: d.title,
        duration: Math.round(d.duration),
        status: d.status,
        value: d.value
      })),
      count: closedDeals.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Deal Stage Duration Report
 * - Average time spent in each stage
 * - Identify bottlenecks
 */
async function getStageDuration(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { pipelineId, startDate, endDate } = req.query;

    if (!pipelineId) {
      return res.status(400).json({ message: 'pipelineId is required for stage duration report' });
    }

    // Get pipeline to know all stages
    const pipeline = await Pipeline.findOne({
      _id: pipelineId,
      workspace
    });

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    // Build filter
    const matchStage = {
      workspace: workspace,
      pipeline: mongoose.Types.ObjectId.isValid(pipelineId) ? new mongoose.Types.ObjectId(pipelineId) : pipelineId
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Get all deals with stage history
    const deals = await Deal.find(matchStage).lean();

    // Calculate average time per stage
    const stageTimings = {};

    deals.forEach((deal) => {
      const history = deal.stageHistory || [];

      for (let i = 0; i < history.length; i++) {
        const stage = history[i];
        const nextStage = history[i + 1];

        const stageName = stage.stage;
        const timeInStage = nextStage
          ? (new Date(nextStage.timestamp) - new Date(stage.timestamp)) / (1000 * 60 * 60 * 24) // days
          : (new Date() - new Date(stage.timestamp)) / (1000 * 60 * 60 * 24); // still in stage

        if (!stageTimings[stageName]) {
          stageTimings[stageName] = {
            total: 0,
            count: 0,
            avg: 0
          };
        }

        stageTimings[stageName].total += timeInStage;
        stageTimings[stageName].count += 1;
      }
    });

    // Calculate averages
    Object.keys(stageTimings).forEach((stage) => {
      stageTimings[stage].avg = Math.round(stageTimings[stage].total / stageTimings[stage].count);
    });

    res.json({
      success: true,
      pipelineName: pipeline.name,
      stageTimings,
      dealsAnalyzed: deals.length
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPipelinePerformance,
  getFunnelReport,
  getAgentPerformance,
  getDealVelocity,
  getStageDuration
};
