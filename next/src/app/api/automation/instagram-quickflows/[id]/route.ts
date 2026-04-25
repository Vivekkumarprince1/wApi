import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { InstagramQuickflow } from '@/lib/models';

/**
 * GET/PUT/DELETE /api/automation/instagram-quickflows/[id]
 */
export const GET = withAuth(async (req, { params, workspace }) => {
  try {
    await dbConnect();
    const quickflow = await InstagramQuickflow.findOne({
      _id: params.id,
      workspace: workspace._id
    }).lean();

    if (!quickflow) {
      return NextResponse.json({ success: false, error: 'Quickflow not found' }, { status: 404 });
    }

    return NextResponse.json(quickflow);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, { params, workspace }) => {
  try {
    await dbConnect();
    const data = await req.json();

    const quickflow = await InstagramQuickflow.findOneAndUpdate(
      {
        _id: params.id,
        workspace: workspace._id
      },
      { ...data },
      { returnDocument: 'after' }
    );

    if (!quickflow) {
      return NextResponse.json({ success: false, error: 'Quickflow not found' }, { status: 404 });
    }

    return NextResponse.json(quickflow);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { params, workspace }) => {
  try {
    await dbConnect();
    const quickflow = await InstagramQuickflow.findOneAndDelete({
      _id: params.id,
      workspace: workspace._id
    });

    if (!quickflow) {
      return NextResponse.json({ success: false, error: 'Quickflow not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Quickflow deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * PATCH /api/automation/instagram-quickflows/[id]/toggle
 */
export const PATCH = withAuth(async (req, { params, workspace }) => {
  try {
    await dbConnect();
    const quickflow = await InstagramQuickflow.findOne({
      _id: params.id,
      workspace: workspace._id
    });

    if (!quickflow) {
      return NextResponse.json({ success: false, error: 'Quickflow not found' }, { status: 404 });
    }

    quickflow.enabled = !quickflow.enabled;
    await quickflow.save();

    return NextResponse.json(quickflow);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
