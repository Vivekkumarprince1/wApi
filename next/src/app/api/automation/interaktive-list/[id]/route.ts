import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withFeature, withRole } from '@/lib/middlewares/auth';
import { InteraktiveList } from '@/lib/models';

/**
 * GET /api/automation/interaktive-list/[id]
 */
export const GET = withFeature('AUTOMATION', async (_req: NextRequest, { params, workspace }: any) => {
  try {
    await dbConnect();

    const doc = await InteraktiveList.findOne({
      _id: params.id,
      workspace: workspace._id,
      deletedAt: null,
    }).lean();

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Interaktive list not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * PUT /api/automation/interaktive-list/[id]
 */
export const PUT = withFeature(
  'AUTOMATION',
  withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { params, workspace, user }: any) => {
    try {
      await dbConnect();
      const payload = await req.json();

      const sections = Array.isArray(payload?.message?.sections) ? payload.message.sections : [];
      const hasRows = sections.some((section: any) => Array.isArray(section?.rows) && section.rows.length > 0);
      if (!hasRows) {
        return NextResponse.json({ success: false, error: 'At least one list row is required' }, { status: 400 });
      }

      const doc = await InteraktiveList.findOneAndUpdate(
        {
          _id: params.id,
          workspace: workspace._id,
          deletedAt: null,
        },
        {
          $set: {
            name: payload.name,
            description: payload.description,
            enabled: payload.enabled,
            triggerKeywords: Array.isArray(payload.triggerKeywords)
              ? payload.triggerKeywords.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean)
              : [],
            message: {
              header: payload?.message?.header,
              body: payload?.message?.body,
              footer: payload?.message?.footer,
              buttonText: payload?.message?.buttonText,
              sections,
            },
            updatedBy: user?._id,
          },
        },
        { returnDocument: 'after' }
      );

      if (!doc) {
        return NextResponse.json({ success: false, error: 'Interaktive list not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: doc });
    } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  })
);

/**
 * PATCH /api/automation/interaktive-list/[id]
 */
export const PATCH = withFeature(
  'AUTOMATION',
  withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { params, workspace, user }: any) => {
    try {
      await dbConnect();
      const payload = await req.json();

      const updateData: any = { updatedBy: user?._id };
      if (typeof payload?.enabled === 'boolean') {
        updateData.enabled = payload.enabled;
      }

      const doc = await InteraktiveList.findOneAndUpdate(
        { _id: params.id, workspace: workspace._id, deletedAt: null },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!doc) {
        return NextResponse.json({ success: false, error: 'Interaktive list not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: doc });
    } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  })
);

/**
 * DELETE /api/automation/interaktive-list/[id]
 */
export const DELETE = withFeature(
  'AUTOMATION',
  withRole(['owner', 'admin'], async (_req: NextRequest, { params, workspace, user }: any) => {
    try {
      await dbConnect();

      const doc = await InteraktiveList.findOneAndUpdate(
        { _id: params.id, workspace: workspace._id, deletedAt: null },
        { $set: { deletedAt: new Date(), updatedBy: user?._id } },
        { returnDocument: 'after' }
      );

      if (!doc) {
        return NextResponse.json({ success: false, error: 'Interaktive list not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'Interaktive list deleted' });
    } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  })
);
