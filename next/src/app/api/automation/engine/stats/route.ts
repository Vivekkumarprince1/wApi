import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { AutomationExecution, AutomationRule } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

/**
 * GET /api/automation/engine/stats
 * Returns execution stats for the workspace (or a specific rule) over N days.
 * Mirrors legacy automationController.getStats
 */
export const GET = withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const ruleId = searchParams.get('ruleId');
  const days = parseInt(searchParams.get('days') || '7');
  const since = new Date(Date.now() - days * 86400 * 1000);

  const matchStage: any = {
    workspace: workspace._id,
    executedAt: { $gte: since }
  };
  if (ruleId) matchStage.ruleId = ruleId;

  const [overview, dailyTrend, [enabledCount, totalCount]] = await Promise.all([
    AutomationExecution.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } }
        }
      }
    ]),
    AutomationExecution.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$executedAt' } },
          count: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Promise.all([
      AutomationRule.countDocuments({ workspace: workspace._id, enabled: true }),
      AutomationRule.countDocuments({ workspace: workspace._id })
    ])
  ]);

  const stats = overview[0] || { total: 0, success: 0, failed: 0, skipped: 0 };

  return NextResponse.json({
    success: true,
    data: {
      period: `${days}d`,
      overview: stats,
      successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
      rules: { enabled: enabledCount, total: totalCount },
      dailyTrend
    }
  });
});
