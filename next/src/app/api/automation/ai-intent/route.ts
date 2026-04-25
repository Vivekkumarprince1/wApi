import { NextRequest, NextResponse } from 'next/server';
import { withRole, withFeature } from '@/lib/middlewares/auth';
import { AiIntentMatchLog, AutomationRule } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

/**
 * GET /api/automation/ai-intent
 * List all AI intent rules for the workspace
 */
export const GET = withFeature('AI_INTENT', withRole(['owner', 'admin', 'manager', 'agent'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const enabled = searchParams.get('enabled');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const query: any = {
    workspace: workspace._id,
    'trigger.type': 'ai_intent'
  };
  if (enabled !== null) query.enabled = enabled === 'true';

  const [rules, total] = await Promise.all([
    AutomationRule.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AutomationRule.countDocuments(query)
  ]);

  // Get recent match logs for each rule
  const ruleIds = rules.map((r: any) => r._id);
  const recentLogs = await AiIntentMatchLog.aggregate([
    { $match: { workspace: workspace._id, matchedRule: { $in: ruleIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$matchedRule', count: { $sum: 1 }, lastMatch: { $first: '$createdAt' } } }
  ]);
  const logMap = Object.fromEntries(recentLogs.map((l: any) => [l._id.toString(), l]));

  const enriched = rules.map((r: any) => ({
    ...r,
    stats: logMap[r._id.toString()] || { count: 0, lastMatch: null }
  }));

  return NextResponse.json({
    success: true,
    data: { rules: enriched, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
  });
}));

/**
 * POST /api/automation/ai-intent
 * Create a new AI Intent rule (NLU training example + action)
 */
export const POST = withFeature('AI_INTENT', withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace, user }) => {
  await dbConnect();

  const { name, intentLabel, trainingPhrases, actions, enabled = true } = await req.json();

  if (!name || !intentLabel) {
    return NextResponse.json({ success: false, error: 'Name and intentLabel are required' }, { status: 400 });
  }
  if (!Array.isArray(trainingPhrases) || trainingPhrases.length < 2) {
    return NextResponse.json({ success: false, error: 'At least 2 training phrases are required' }, { status: 400 });
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one action is required' }, { status: 400 });
  }

  const rule = await AutomationRule.create({
    workspace: workspace._id,
    name,
    enabled,
    trigger: {
      type: 'ai_intent',
      event: 'ai_intent',
      config: { intentLabel, trainingPhrases }
    },
    conditions: [],
    actions,
    createdBy: user._id
  });

  return NextResponse.json({ success: true, data: rule }, { status: 201 });
}));
