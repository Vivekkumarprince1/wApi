import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { InstagramQuickflow } from '@/lib/models';

/**
 * GET /api/automation/instagram-quickflows
 * List all Instagram quickflows for the workspace
 */
export const GET = withFeature('INSTAGRAM_QUICKFLOWS', withAuth(async (req, { workspace }) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const enabled = searchParams.get('enabled');
    const type = searchParams.get('type');
    const triggerType = searchParams.get('triggerType');

    const query: any = {
      workspace: workspace._id
    };

    if (enabled !== null) {
      query.enabled = enabled === 'true';
    }

    if (type) {
      query.type = type;
    }

    if (triggerType) {
      query.triggerType = triggerType;
    }

    const quickflows = await InstagramQuickflow.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(quickflows);

  } catch (error: any) {
    console.error('API Error [InstagramQuickflows/GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}));

/**
 * POST /api/automation/instagram-quickflows
 * Create a new Instagram quickflow
 */
export const POST = withFeature('INSTAGRAM_QUICKFLOWS', withAuth(async (req, { workspace }) => {
  try {
    await dbConnect();
    const data = await req.json();

    if (!data.name || !data.type || !data.triggerType) {
      return NextResponse.json({ success: false, error: 'Name, type, and triggerType are required' }, { status: 400 });
    }

    const quickflow = await InstagramQuickflow.create({
      ...data,
      workspace: workspace._id,
      keywords: data.keywords?.map((k: string) => k.toLowerCase()) || []
    });

    return NextResponse.json(quickflow, { status: 201 });

  } catch (error: any) {
    console.error('API Error [InstagramQuickflows/POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}));
