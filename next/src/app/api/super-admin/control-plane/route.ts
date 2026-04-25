import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { SuperAdminControlPlaneService } from '@/lib/services/super-admin/control-plane-service';
import { SUPER_ADMIN_CONTROL_PLANE_MANIFEST } from '@/lib/super-admin/control-plane-manifest';

export const GET = withRole(['super_admin'], async (_req: NextRequest) => {
  try {
    await dbConnect();

    const snapshot = await SuperAdminControlPlaneService.buildSnapshot();

    return NextResponse.json({
      success: true,
      data: {
        manifest: SUPER_ADMIN_CONTROL_PLANE_MANIFEST,
        snapshot,
      },
    });
  } catch (error: any) {
    console.error('[Super Admin Control Plane API Error]:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to build control-plane snapshot',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}) as any;
