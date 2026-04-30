import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import { GupshupPartnerService } from "@/lib/services/bsp/gupshup-partner-service";
import dbConnect from "@/lib/db-connect";

function pickDisplayNameFromRemote(raw: any) {
  const info = raw?.displayNameInfo || raw?.data?.displayNameInfo || raw?.data || raw || {};

  return {
    displayName: info.requestedName || info.verifiedName || info.displayName,
    displayNameInfo: {
      verifiedNameStatus: info.verifiedNameStatus,
      requestedName: info.requestedName,
      requestedNameStatus: info.requestedNameStatus,
      verifiedName: info.verifiedName,
    }
  };
}

/**
 * PATCH /api/workspace/whatsapp/profile/display-name
 * Update only display name via Gupshup profile name endpoint.
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const body = await req.json();
  const displayName = String(body?.displayName || '').trim();

  if (!displayName) {
    return NextResponse.json({ success: false, message: 'Display name is required.' }, { status: 400 });
  }

  if (!workspace.gupshupAppId) {
    return NextResponse.json({ success: false, message: 'No Gupshup app assigned for this workspace.' }, { status: 400 });
  }

  try {
    // 1) Submit display-name update request to Meta via Gupshup
    await GupshupPartnerService.updateProfileDisplayName(workspace.gupshupAppId, displayName);

    // 2) Fetch latest display-name state once and cache in DB
    const remoteDisplayNameRaw = await GupshupPartnerService.getProfileDisplayName(workspace.gupshupAppId);
    const remoteDisplayName = pickDisplayNameFromRemote(remoteDisplayNameRaw);
    const resolvedDisplayName = String(remoteDisplayName.displayName || displayName).trim();

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspace._id,
      {
        $set: {
          'businessProfile.displayName': resolvedDisplayName,
          'businessProfile.displayNameInfo': remoteDisplayName.displayNameInfo,
        }
      },
      { returnDocument: 'after' }
    );

    if (!updatedWorkspace) {
      return NextResponse.json({ success: false, message: 'Workspace update failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Display name updated on Meta and synced to local database.',
      data: {
        displayName: resolvedDisplayName,
        displayNameInfo: updatedWorkspace.businessProfile?.displayNameInfo || null,
      }
    });
  } catch (error: any) {
    console.error('[WABAProfile] Failed to update display name on Gupshup:', error?.message || error);
    return NextResponse.json({ success: false, message: error?.message || 'Display name update failed' }, { status: 500 });
  }
});
