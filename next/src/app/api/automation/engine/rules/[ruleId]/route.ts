import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { AutomationRule } from '@/lib/models';

/**
 * GET /api/automation/engine/rules/[ruleId]
 * PUT /api/automation/engine/rules/[ruleId]
 * DELETE /api/automation/engine/rules/[ruleId]
 */

export const GET = withAuth(async (req, { params, workspace }) => {
  try {
    await dbConnect();
    const { ruleId } = await Promise.resolve(params);

    const rule = await AutomationRule.findOne({
      _id: ruleId,
      workspace: workspace._id,
      deletedAt: null
    }).lean();

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rule });

  } catch (error: any) {
    console.error('API Error [Rule/GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, { params, workspace, user }) => {
  try {
    await dbConnect();
    const { ruleId } = await Promise.resolve(params);
    const updates = await req.json();

    const rule = await AutomationRule.findOneAndUpdate(
      {
        _id: ruleId,
        workspace: workspace._id,
        deletedAt: null
      },
      { 
        ...updates,
        updatedBy: user._id
      },
      { returnDocument: 'after' }
    );

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rule });

  } catch (error: any) {
    console.error('API Error [Rule/PUT]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { params, workspace }) => {
  try {
    await dbConnect();
    const { ruleId } = await Promise.resolve(params);

    const rule = await AutomationRule.findOneAndUpdate(
      {
        _id: ruleId,
        workspace: workspace._id,
        deletedAt: null
      },
      { 
        deletedAt: new Date(),
        enabled: false
      },
      { returnDocument: 'after' }
    );

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Rule deleted successfully' });

  } catch (error: any) {
    console.error('API Error [Rule/DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
