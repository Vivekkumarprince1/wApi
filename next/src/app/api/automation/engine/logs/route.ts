import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { AutomationExecution, AutomationAuditLog, AutomationRule } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

/**
 * GET /api/automation/engine/logs
 * Automation execution logs with filters (ruleId, status, triggerType, pagination)
 */
export const GET = withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const ruleId = searchParams.get('ruleId');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const query: any = { workspace: workspace._id };
  if (ruleId) query.ruleId = ruleId;
  if (status) query.status = status;

  const [logs, total] = await Promise.all([
    AutomationExecution.find(query)
      .sort({ executedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('ruleId', 'name')
      .lean(),
    AutomationExecution.countDocuments(query)
  ]);

  return NextResponse.json({
    success: true,
    data: {
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    }
  });
});
