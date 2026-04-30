import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { GupshupPartnerService } from '@/lib/services/bsp/gupshup-partner-service';
import dbConnect from '@/lib/db-connect';
import { config } from '@/lib/config';
import { canViewWebhookStatus, resolveWebhookPolicy } from '@/lib/services/super-admin/webhook-rbac-service';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

function getErrorMessage(error: unknown, fallback = 'Request failed') {
  const root = asRecord(error);
  const rootMessage = root?.message;
  if (typeof rootMessage === 'string' && rootMessage.trim().length > 0) {
    return rootMessage;
  }

  const response = asRecord(root?.response);
  const responseData = asRecord(response?.data);
  const responseMessage = responseData?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
    return responseMessage;
  }

  return fallback;
}

function buildWebhookUrl() {
  const publicUrl = process.env.APP_URL || config.whatsappWebhookUrl || '';
  const isPublicSecure = publicUrl.startsWith('https://');
  const suggestedWebhookUrl = isPublicSecure
    ? (publicUrl.endsWith('/api/webhooks/whatsapp') ? publicUrl : `${publicUrl}/api/webhooks/whatsapp`)
    : null;

  return {
    isPublicSecure,
    suggestedWebhookUrl,
  };
}

function serializePolicy(effective: unknown) {
  const policy = asRecord(effective);

  return {
    source: policy?.source,
    scopeChain: policy?.scopeChain,
    webhookEnabled: policy?.webhookEnabled,
    webhookMode: policy?.webhookMode,
    defaultModes: policy?.defaultModes,
    allowedModes: policy?.allowedModes,
    statusViewRoles: policy?.statusViewRoles,
    subscriptionVersion: policy?.subscriptionVersion,
  };
}

/**
 * GET /api/workspace/whatsapp/subscriptions/status
 * Read-only subscription status for roles allowed by super-admin policy.
 */
export const GET = withAuth(async (_req: NextRequest, { workspace, user }) => {
  await dbConnect();

  if (!workspace?._id) {
    return NextResponse.json(
      {
        success: false,
        message: 'No active workspace selected.',
      },
      { status: 400 }
    );
  }

  const policySnapshot = await resolveWebhookPolicy({
    workspaceId: String(workspace._id),
    appId: workspace.gupshupAppId ? String(workspace.gupshupAppId) : undefined,
  });

  if (!canViewWebhookStatus(user?.role, policySnapshot.effective)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Webhook status visibility is restricted by super admin policy.',
        policy: serializePolicy(policySnapshot.effective),
      },
      { status: 403 }
    );
  }

  if (!workspace.gupshupAppId) {
    return NextResponse.json({
      success: true,
      data: [],
      meta: {
        hasSecureTunnel: buildWebhookUrl().isPublicSecure,
        suggestedWebhookUrl: buildWebhookUrl().suggestedWebhookUrl,
        canManageSubscriptions: user?.role === 'super_admin',
        policy: serializePolicy(policySnapshot.effective),
      },
    });
  }

  try {
    const subscriptions = await GupshupPartnerService.listSubscriptions(workspace.gupshupAppId);
    const webhookUrl = buildWebhookUrl();

    return NextResponse.json({
      success: true,
      data: Array.isArray(subscriptions) ? subscriptions : [],
      meta: {
        hasSecureTunnel: webhookUrl.isPublicSecure,
        suggestedWebhookUrl: webhookUrl.suggestedWebhookUrl,
        canManageSubscriptions: user?.role === 'super_admin',
        policy: serializePolicy(policySnapshot.effective),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error, 'Failed to fetch subscription status.'),
      },
      { status: 500 }
    );
  }
});
