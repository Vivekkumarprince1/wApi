import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { Workspace } from '@/lib/models';

export const POST = withRole(['super_admin'], async (req: NextRequest, { user }) => {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId ? String(body.workspaceId) : null;
    const reason = String(body.reason || 'Emergency freeze initiated by super admin').trim();

    if (workspaceId) {
      const workspace = await Workspace.findByIdAndUpdate(
        workspaceId,
        { $set: { billingStatus: 'suspended', suspensionReason: reason } },
        { returnDocument: 'after' }
      );

      if (!workspace) {
        return NextResponse.json({ success: false, message: 'Workspace not found' }, { status: 404 });
      }
    }

    console.log('[SuperAdminFreeze]', { by: user.email, workspaceId, reason });

    return NextResponse.json({
      success: true,
      message: workspaceId ? 'Workspace frozen' : 'Platform freeze command recorded',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to execute emergency freeze', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}) as any;
