import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { AutomationRule } from '@/lib/models';

/**
 * PATCH /api/automation/engine/rules/[ruleId]/toggle
 * Toggle enabled status of a rule
 */
export const PATCH = withAuth(async (req, { params, workspace, user }) => {
  try {
    await dbConnect();
    const { ruleId } = await Promise.resolve(params);
    const { enabled } = await req.json();

    if (enabled === undefined) {
      return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
    }

    const rule = await AutomationRule.findOneAndUpdate(
      {
        _id: ruleId,
        workspace: workspace._id,
        deletedAt: null
      },
      { 
        enabled,
        updatedBy: user._id
      },
      { returnDocument: 'after' }
    );

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { enabled: rule.enabled }
    });

  } catch (error: any) {
    console.error('API Error [Rule/TOGGLE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
