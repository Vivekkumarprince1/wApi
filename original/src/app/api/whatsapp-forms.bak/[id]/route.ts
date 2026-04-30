import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { WhatsAppForm } from '@/lib/models';

export const GET = withAuth(async (_req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();

    const form = await WhatsAppForm.findOne({
      _id: params.id,
      workspace: workspace._id,
      deletedAt: null,
    }).lean();

    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: form });
  } catch (error: any) {
    console.error('API Error [WhatsApp Form/GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

async function updateHandler(req: NextRequest, { workspace, user, params }: any) {
  try {
    await dbConnect();

    const updates = await req.json();

    const current = await WhatsAppForm.findOne({
      _id: params.id,
      workspace: workspace._id,
      deletedAt: null,
    });

    if (!current) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    // Preserve parity: published forms are immutable through edit endpoint.
    if (current.status === 'published') {
      return NextResponse.json({ success: false, error: 'Published forms cannot be edited. Unpublish first.' }, { status: 400 });
    }

    const updated = await WhatsAppForm.findOneAndUpdate(
      { _id: params.id, workspace: workspace._id, deletedAt: null },
      {
        $set: {
          name: updates.name ?? current.name,
          description: updates.description ?? current.description,
          flowType: updates.flowType ?? current.flowType,
          flowId: updates.flowId ?? current.flowId,
          screens: Array.isArray(updates.screens) ? updates.screens : current.screens,
          rawFlowJson: updates.rawFlowJson ?? current.rawFlowJson,
          dataMapping: Array.isArray(updates.dataMapping) ? updates.dataMapping : current.dataMapping,
          webhookConfig: updates.webhookConfig
            ? { ...current.webhookConfig, ...updates.webhookConfig }
            : current.webhookConfig,
          config: updates.config ? { ...current.config, ...updates.config } : current.config,
          tags: Array.isArray(updates.tags) ? updates.tags : current.tags,
          category: updates.category ?? current.category,
          updatedBy: user?._id,
        },
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('API Error [WhatsApp Form/UPDATE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const PUT = withAuth(updateHandler);
export const PATCH = withAuth(updateHandler);

export const DELETE = withAuth(async (_req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();

    const form = await WhatsAppForm.findOneAndUpdate(
      { _id: params.id, workspace: workspace._id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Form deleted successfully' });
  } catch (error: any) {
    console.error('API Error [WhatsApp Form/DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
