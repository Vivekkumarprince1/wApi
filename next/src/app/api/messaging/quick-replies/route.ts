import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { QuickReply } from '@/lib/models';

/**
 * GET /api/messaging/quick-replies
 * Fetch all quick replies for the current workspace
 */
export const GET = withAuth(async (req, { workspace }) => {
  try {
    await dbConnect();
    const quickReplies = await QuickReply.find({ 
      workspace: workspace._id,
      isActive: true 
    }).sort({ name: 1 });

    return NextResponse.json({
      success: true,
      data: quickReplies
    });
  } catch (err: any) {
    console.error('[QuickReply API] GET error:', err);
    return NextResponse.json({ success: false, message: 'Failed to fetch quick replies' }, { status: 500 });
  }
});

/**
 * POST /api/messaging/quick-replies
 * Create a new quick reply
 */
export const POST = withAuth(async (req, { workspace, user }) => {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, content, shortcut, variables, mediaUrl, mediaType } = body;

    if (!name || !content) {
      return NextResponse.json({ success: false, message: 'Name and content are required' }, { status: 400 });
    }

    const quickReply = await QuickReply.create({
      workspace: workspace._id,
      name,
      content,
      shortcut: shortcut?.startsWith('/') ? shortcut : `/${shortcut}`,
      variables,
      mediaUrl,
      mediaType,
      createdBy: user._id
    });

    return NextResponse.json({
      success: true,
      data: quickReply
    }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000) {
      return NextResponse.json({ success: false, message: 'A quick reply with this name already exists' }, { status: 400 });
    }
    console.error('[QuickReply API] POST error:', err);
    return NextResponse.json({ success: false, message: 'Failed to create quick reply' }, { status: 500 });
  }
});
