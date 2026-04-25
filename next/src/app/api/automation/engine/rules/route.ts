// Updated: 2026-04-13 10:48 (Forced rebuild)
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { AutomationRule } from '@/lib/models';
import { withPlanGate } from '@/lib/middlewares/plan-gate';
import { UsageTracker } from '@/lib/services/billing/usage-tracker';

/**
 * GET /api/automation/engine/rules
 * List and filter automation rules for the workspace
 */
export const GET = withFeature('WORKFLOWS', async (req, { workspace }) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');
    const trigger = searchParams.get('trigger');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = {
      workspace: workspace._id,
      deletedAt: null
    };

    if (category) {
      query.category = category;
    }

    if (enabled !== null) {
      query.enabled = enabled === 'true';
    }

    if (trigger) {
      query.$or = [
        { 'trigger.event': trigger },
        { 'trigger.type': trigger } // Support both legacy and new trigger structures
      ];
    }

    const [rules, total] = await Promise.all([
      AutomationRule.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AutomationRule.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rules,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('API Error [Rules/GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/automation/engine/rules
 * Create a new automation rule
 * Protected by plan limits (maxAutomations)
 */
export const POST = withFeature('WORKFLOWS', withPlanGate('automations')(async (req: any, { workspace, user }: any) => {
  try {
    await dbConnect();
    const data = await req.json();

    if (!data.name) {
      return NextResponse.json({ success: false, error: 'Rule name is required' }, { status: 400 });
    }

    const rule = await AutomationRule.create({
      ...data,
      workspace: workspace._id,
      createdBy: user._id
    });

    // Increment usage counter
    await UsageTracker.increment(workspace._id, 'automations');

    return NextResponse.json({
      success: true,
      data: rule
    }, { status: 201 });

  } catch (error: any) {
    console.error('API Error [Rules/POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}));
