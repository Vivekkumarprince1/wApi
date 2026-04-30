import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { Business, Workspace } from '@/lib/models';
import { syncAssignedGupshupApp } from '@/lib/services/bsp/gupshup-app-assignment-service';

export const POST = withRole(['super_admin'], async (req: NextRequest, { user }) => {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId ? String(body.workspaceId) : null;
    const query: any = workspaceId ? { _id: workspaceId } : { whatsappConnected: true, bspManaged: true };

    const workspaces = await Workspace.find(query).sort({ updatedAt: -1 }).limit(workspaceId ? 1 : 200);
    const results = {
      total: workspaces.length,
      processed: 0,
      failed: 0,
      details: [] as Array<{ workspaceId: string; workspaceName: string; status: string; error?: string }>,
    };

    for (const workspace of workspaces) {
      try {
        const business = await Business.findOne({ workspace: workspace._id });
        await syncAssignedGupshupApp(user, workspace, business);
        results.processed += 1;
        results.details.push({ workspaceId: String(workspace._id), workspaceName: workspace.name, status: 'reconciled' });
      } catch (error: any) {
        results.failed += 1;
        results.details.push({
          workspaceId: String(workspace._id),
          workspaceName: workspace.name,
          status: 'failed',
          error: error?.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: workspaceId
        ? `Reconciled Gupshup state for ${results.processed} workspace.`
        : `Reconciled Gupshup state for ${results.processed} of ${results.total} workspaces.`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to reconcile Gupshup apps', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}) as any;
