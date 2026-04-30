import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { BspHealth, BusinessAppMap, Workspace } from '@/lib/models';

export const GET = withRole(['super_admin'], async (_req: NextRequest) => {
  try {
    await dbConnect();

    const [totalWorkspaces, whatsappConnected, mappedApps, orphanedMappings, bspHealth] = await Promise.all([
      Workspace.countDocuments({}),
      Workspace.countDocuments({ whatsappConnected: true }),
      BusinessAppMap.countDocuments({ active: true }),
      BusinessAppMap.countDocuments({
        active: true,
        $or: [{ workspace: null }, { app: null }, { gupshupAppId: { $in: [null, ''] } }],
      }),
      BspHealth.findOne({ key: 'system_token' }).lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        status: bspHealth?.status || 'unknown',
        isValid: bspHealth?.isValid ?? false,
        totalWorkspaces,
        whatsappConnected,
        mappedApps,
        orphanedMappings,
        lastCheckedAt: bspHealth?.checkedAt || null,
        error: bspHealth?.error || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch Gupshup health', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}) as any;
