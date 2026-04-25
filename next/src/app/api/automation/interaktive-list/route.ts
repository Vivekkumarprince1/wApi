import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withFeature, withRole } from '@/lib/middlewares/auth';
import { InteraktiveList } from '@/lib/models';

/**
 * GET /api/automation/interaktive-list
 */
export const GET = withFeature('INTERAKTIVE_LIST', async (req: NextRequest, { workspace }: any) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search')?.trim();

    const query: any = {
      workspace: workspace._id,
      deletedAt: null,
    };

    if (enabled !== null) {
      query.enabled = enabled === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { triggerKeywords: { $elemMatch: { $regex: search, $options: 'i' } } },
      ];
    }

    const lists = await InteraktiveList.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, data: lists });
  } catch (error: any) {
    console.error('API Error [InteraktiveList/GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/automation/interaktive-list
 */
export const POST = withFeature(
  'INTERAKTIVE_LIST',
  withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace, user }: any) => {
    try {
      await dbConnect();
      const payload = await req.json();

      if (!payload?.name?.trim()) {
        return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
      }

      if (!payload?.message?.body?.trim()) {
        return NextResponse.json({ success: false, error: 'Message body is required' }, { status: 400 });
      }

      const sections = Array.isArray(payload?.message?.sections) ? payload.message.sections : [];
      const hasRows = sections.some((section: any) => Array.isArray(section?.rows) && section.rows.length > 0);

      if (!hasRows) {
        return NextResponse.json({ success: false, error: 'At least one list row is required' }, { status: 400 });
      }

      const doc = await InteraktiveList.create({
        workspace: workspace._id,
        name: payload.name.trim(),
        description: payload.description?.trim(),
        enabled: payload.enabled !== false,
        triggerKeywords: Array.isArray(payload.triggerKeywords)
          ? payload.triggerKeywords.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean)
          : [],
        message: {
          header: payload.message.header?.trim(),
          body: payload.message.body.trim(),
          footer: payload.message.footer?.trim(),
          buttonText: payload.message.buttonText?.trim() || 'Choose Option',
          sections,
        },
        createdBy: user?._id,
        updatedBy: user?._id,
      });

      return NextResponse.json({ success: true, data: doc }, { status: 201 });
    } catch (error: any) {
      console.error('API Error [InteraktiveList/POST]:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  })
);
