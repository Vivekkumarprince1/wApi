import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import { GupshupPartnerService } from "@/lib/services/bsp/gupshup-partner-service";
import dbConnect from "@/lib/db-connect";

function firstNonEmpty(...values: any[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function normalizeMessagingTier(input?: string | null) {
  const raw = String(input || '').trim();
  if (!raw) return 'UNKNOWN';
  if (raw.startsWith('TIER_')) return raw.replace('TIER_', '') + ' / 24h';
  return raw;
}

function normalizeVertical(input?: string | null) {
  const raw = String(input || '').trim();
  if (!raw) return 'PROFESSIONAL_SERVICES';
  return raw.replace(/\s+/g, '_').toUpperCase();
}

function buildProfile(workspace: any, businessProfile?: Record<string, any>) {
  const bp = businessProfile || workspace.businessProfile || {};
  const statusFromPhone = String(workspace.bspPhoneStatus || '').toUpperCase();
  const connected = workspace.whatsappConnected || statusFromPhone === 'CONNECTED';
  const websiteFallback = workspace.website ? [workspace.website] : [];
  const addressFallback = [workspace.address, workspace.city, workspace.state, workspace.country]
    .filter(Boolean)
    .join(', ');

  return {
    displayName: bp.displayName || workspace.bspVerifiedName || workspace.name || "",
    description: firstNonEmpty(bp.description, bp.about, workspace.description),
    address: bp.address || addressFallback || "",
    email: bp.email || "",
    vertical: normalizeVertical(bp.vertical || workspace.industry),
    websites: Array.isArray(bp.websites) && bp.websites.length > 0 ? bp.websites : websiteFallback,
    profilePicUrl: bp.profilePicUrl || null,
    status: connected ? 'CONNECTED' : (statusFromPhone || 'DISCONNECTED'),
    quality: String(workspace.bspQualityRating || workspace.qualityRating || 'UNKNOWN').toUpperCase(),
    limit: normalizeMessagingTier(workspace.bspMessagingTier || workspace.messagingLimitTier),
    lastSyncedAt: workspace.bspLastSyncedAt || null,
    webhookUrl: require('@/lib/services/bsp/gupshup-app-assignment-service').resolveWebhookUrl()
  };
}

function pickBusinessProfileFromRemote(raw: any) {
  const source = raw?.data?.profile || raw?.data || raw?.profile || raw || {};

  const websites = Array.isArray(source.websites)
    ? source.websites
    : (Array.isArray(source.website) ? source.website : []);

  return {
    displayName: source.displayName || source.display_name,
    description: source.description || source.about,
    about: source.about,
    address: source.address,
    email: source.email,
    vertical: source.vertical,
    websites: websites.filter(Boolean),
    profilePicUrl: source.profilePicUrl || source.profile_pic_url || source.photoUrl
  };
}

/**
 * GET /api/workspace/whatsapp/profile
 * Get current WABA profile details
 */
export const GET = withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const profile = buildProfile(workspace);

  return NextResponse.json({
    success: true,
    data: profile
  });
});

/**
 * POST /api/workspace/whatsapp/profile
 * Explicitly sync profile from Gupshup and cache in workspace.businessProfile
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  if (!workspace.gupshupAppId) {
    return NextResponse.json({
      success: false,
      message: 'No Gupshup app assigned for this workspace.'
    }, { status: 400 });
  }

  try {
    const businessRes = await GupshupPartnerService.getBusinessProfile(workspace.gupshupAppId);

    const remoteProfile = pickBusinessProfileFromRemote(businessRes);

    const mergedBusinessProfile = {
      ...(workspace.businessProfile || {}),
      ...Object.fromEntries(Object.entries(remoteProfile).filter(([, value]) => value !== undefined))
    };

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspace._id,
      {
        $set: {
          businessProfile: mergedBusinessProfile,
          bspLastSyncedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!updatedWorkspace) {
      return NextResponse.json({ success: false, message: 'Workspace update failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Profile synced successfully from Meta/Gupshup.',
      data: buildProfile(updatedWorkspace, mergedBusinessProfile)
    });
  } catch (err: any) {
    console.error('[WABAProfile] Failed to sync from Gupshup:', err?.message || err);
    return NextResponse.json({ success: false, message: err?.message || 'Sync failed' }, { status: 500 });
  }
});

/**
 * PATCH /api/workspace/whatsapp/profile
 * Update WABA profile details (Syncs to Meta)
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();
  
  const body = await req.json();
  const { displayName, description, address, email, vertical, websites } = body;
  const normalizedVertical = normalizeVertical(vertical);
  const normalizedWebsites = Array.isArray(websites) ? websites.filter((site: any) => String(site || '').trim().length > 0) : [];

  // 1. Update in local DB
  const newBp = {
    ...(workspace.businessProfile || {}),
    displayName,
    description,
    address,
    email,
    vertical: normalizedVertical,
    websites: normalizedWebsites
  };

  // 1. Update in local DB
  const updatedWorkspace = await Workspace.findByIdAndUpdate(
    workspace._id,
    {
      $set: {
        businessProfile: newBp,
        description: description || workspace.description,
        address: address || workspace.address,
        industry: normalizedVertical || workspace.industry,
        website: normalizedWebsites[0] || workspace.website
      }
    },
    { returnDocument: 'after' }
  );

  if (!updatedWorkspace) {
    return NextResponse.json({ error: "Workspace update failed" }, { status: 500 });
  }

  
  try {
    if (workspace.gupshupAppId) {
      if (displayName && String(displayName).trim().length > 0) {
        await GupshupPartnerService.updateProfileDisplayName(workspace.gupshupAppId, displayName);
      }

      await GupshupPartnerService.updateBusinessProfile(workspace.gupshupAppId, {
        description,
        address,
        email,
        vertical: normalizedVertical,
        websites: normalizedWebsites
      });
      console.log(`[WABAProfile] Successfully synced profile to Gupshup for ${workspace.id}`);
    } else {
       console.log(`[WABAProfile] Skipping Meta push for ${workspace.id} (no gupshup app id)`);
    }
  } catch (e) {
    console.error("[WABAProfile] Failed to push update to Gupshup API:", e);
  }


  return NextResponse.json({
    success: true,
    message: "Profile updated successfully. Changes may take up to 30 mins to reflect on WhatsApp.",
    data: buildProfile(updatedWorkspace, newBp)
  });
});

