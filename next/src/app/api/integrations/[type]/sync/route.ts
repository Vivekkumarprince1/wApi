import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Integration } from '@/lib/models/integration/Integration';
import { GoogleSheetsService } from '@/lib/services/integrations/google-sheets-service';
import { PetpoojaService } from '@/lib/services/integrations/petpooja-service';

/**
 * POST /api/integrations/[type]/sync
 * Manually trigger a sync for a specific integration
 */
export const POST = withAuth(async (req, { user, params }) => {
  try {
    const resolvedParams = await Promise.resolve(params);
    const type = resolvedParams.type;

    const integration = await Integration.findOne({ 
      workspace: user.workspace, 
      type: type,
      status: 'connected'
    });

    if (!integration) {
      return NextResponse.json({ message: 'No active integration found for this provider.' }, { status: 404 });
    }

    // Cooldown check (60 seconds)
    const lastSync = integration.lastSyncAt ? new Date(integration.lastSyncAt).getTime() : 0;
    const now = Date.now();
    if (now - lastSync < 60000) {
      return NextResponse.json({ 
        message: 'Sync recently completed. Please wait a moment before refreshing again.',
        cooldown: true
      }, { status: 429 });
    }

    console.log(`[ManualSync] Triggering ${type} sync for Workspace ${user.workspace}`);

    let recordsFound = 0;
    if (type === 'google_sheets') {
      await GoogleSheetsService.syncRows(user.workspace.toString());
    } else if (type === 'petpooja') {
      await PetpoojaService.syncOrders(user.workspace.toString());
    } else {
      return NextResponse.json({ message: 'Manual sync not supported for this provider yet.' }, { status: 400 });
    }

    // Fetch the updated record
    const updated = await Integration.findById(integration._id);

    return NextResponse.json({ 
      message: 'Sync completed successfully.',
      lastSyncAt: updated?.lastSyncAt,
      recordsCount: updated?.usage?.lastSyncRecordsCount || 0
    });
  } catch (err: any) {
    console.error(`[ManualSync] Error for ${user.workspace}:`, err.message);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
});
