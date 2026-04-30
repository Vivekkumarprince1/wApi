import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { WhatsAppForm } from '@/lib/models';

export const POST = withAuth(async (_req: NextRequest, { workspace, user, params }) => {
  try {
    await dbConnect();

    const existing = await WhatsAppForm.findOne({
      _id: params.id,
      workspace: workspace._id,
      deletedAt: null,
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    const hasScreens = Array.isArray(existing.screens) && existing.screens.length > 0;
    const hasRawPayload = !!existing.rawFlowJson;
    if (!hasScreens && !hasRawPayload) {
      return NextResponse.json(
        { success: false, error: 'Cannot publish an empty form. Add screens or flow JSON first.' },
        { status: 400 }
      );
    }

    const resolvedFlowId =
      existing.flowId ||
      existing.rawFlowJson?.flow_id ||
      existing.rawFlowJson?.flowId ||
      `${existing._id}`;

    const form = await WhatsAppForm.findOneAndUpdate(
      { _id: params.id, workspace: workspace._id, deletedAt: null },
      {
        $set: {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: user?._id,
          flowId: resolvedFlowId,
        },
      },
      { returnDocument: 'after' }
    );

    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: form, message: 'Form published' });
  } catch (error: any) {
    console.error('API Error [WhatsApp Form/PUBLISH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
