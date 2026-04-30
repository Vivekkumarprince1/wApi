import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { isSuperAdmin } from '@/lib/middlewares/auth';
import { WebhookConfigAuditLog } from '@/lib/models';

function getErrorMessage(error: unknown, fallback = 'Request failed') {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

export const GET = isSuperAdmin(async (req: NextRequest) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const appId = searchParams.get('appId') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const query: Record<string, unknown> = {};

    if (workspaceId) query.workspace = workspaceId;
    if (appId) query.appId = appId;

    const records = await WebhookConfigAuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'name email role')
      .lean();

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error, 'Failed to fetch webhook config audit records'),
      },
      { status: 500 }
    );
  }
});
