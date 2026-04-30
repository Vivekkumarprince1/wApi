import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/middlewares/auth";
import { GupshupPartnerService } from "@/lib/services/bsp/gupshup-partner-service";
import dbConnect from "@/lib/db-connect";
import { config } from "@/lib/config";
import { WebhookConfigAuditLog } from "@/lib/models";
import { resolveWebhookPolicy, resolveSubscriptionModesForPolicy } from "@/lib/services/super-admin/webhook-rbac-service";

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

function getErrorStatus(error: unknown, fallback = 500) {
  const root = asRecord(error);
  const directStatus = root?.status;
  if (typeof directStatus === 'number') {
    return directStatus;
  }

  const response = asRecord(root?.response);
  const responseStatus = response?.status;
  if (typeof responseStatus === 'number') {
    return responseStatus;
  }

  return fallback;
}

function getErrorData(error: unknown) {
  const root = asRecord(error);
  const response = asRecord(root?.response);
  return asRecord(response?.data) || {};
}

function getErrorDetails(error: unknown) {
  const root = asRecord(error);
  return root?.details;
}

function buildWebhookUrl() {
  const publicUrl = process.env.APP_URL || config.whatsappWebhookUrl || "";
  const isPublicSecure = publicUrl.startsWith("https://");
  const url = isPublicSecure
    ? (publicUrl.endsWith('/api/webhooks/whatsapp') ? publicUrl : `${publicUrl}/api/webhooks/whatsapp`)
    : "";

  return {
    publicUrl,
    isPublicSecure,
    url,
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
 * GET /api/workspace/whatsapp/subscriptions
 * List all active V3 subscriptions for the workspace app
 */
export const GET = isSuperAdmin(async (req: NextRequest, { workspace }) => {
  await dbConnect();

  if (!workspace?._id) {
    return NextResponse.json({ success: false, message: 'No active workspace selected.' }, { status: 400 });
  }

  const policySnapshot = await resolveWebhookPolicy({
    workspaceId: String(workspace._id),
    appId: workspace.gupshupAppId ? String(workspace.gupshupAppId) : undefined,
  });
  
  if (!workspace.gupshupAppId) {
    return NextResponse.json({
      success: true,
      data: [],
      meta: {
        policy: serializePolicy(policySnapshot.effective),
      },
    });
  }

  try {
    const subscriptions = await GupshupPartnerService.listSubscriptions(workspace.gupshupAppId);

    const { isPublicSecure, url } = buildWebhookUrl();
    const suggestedWebhookUrl = isPublicSecure ? url : null;

    return NextResponse.json({
      success: true,
      data: Array.isArray(subscriptions) ? subscriptions : [],
      meta: {
        suggestedWebhookUrl,
        environment: process.env.NODE_ENV,
        hasSecureTunnel: !!isPublicSecure,
        policy: serializePolicy(policySnapshot.effective),
      }
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Failed to fetch subscriptions');
    console.error("[SubscriptionsAPI] GET Error:", message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});

/**
 * POST /api/workspace/whatsapp/subscriptions
 * Add a new subscription
 */
export const POST = isSuperAdmin(async (req: NextRequest, { workspace, user }) => {
  await dbConnect();

  if (!workspace?._id) {
    return NextResponse.json({ success: false, message: 'No active workspace selected.' }, { status: 400 });
  }

  const policySnapshot = await resolveWebhookPolicy({
    workspaceId: String(workspace._id),
    appId: workspace.gupshupAppId ? String(workspace.gupshupAppId) : undefined,
  });

  if (!policySnapshot.effective.webhookEnabled) {
    return NextResponse.json(
      { success: false, message: 'Webhook subscriptions are disabled by super admin policy.' },
      { status: 403 }
    );
  }
  
  if (!workspace.gupshupAppId) {
    return NextResponse.json({ success: false, message: "No Gupshup App assigned" }, { status: 400 });
  }

  const body = await req.json();
  const requestedEvents = Array.isArray(body?.events) ? body.events : undefined;

  let events: string[] = [];
  try {
    events = resolveSubscriptionModesForPolicy({
      requestedModes: requestedEvents,
      effectivePolicy: policySnapshot.effective,
      version: policySnapshot.effective.subscriptionVersion,
    });
  } catch (policyError: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(policyError, 'Subscription modes are blocked by policy.'),
        details: getErrorDetails(policyError),
      },
      { status: getErrorStatus(policyError, 400) }
    );
  }

  const { url } = buildWebhookUrl();

  if (!url) {
    return NextResponse.json(
      {
        success: false,
        message: 'A secure HTTPS APP_URL or webhook URL is required to configure subscriptions.',
      },
      { status: 400 }
    );
  }
  
  try {
    const result = await GupshupPartnerService.setSubscription({
      appId: workspace.gupshupAppId,
      url,
      events
    });

    await WebhookConfigAuditLog.logChange({
      scope: 'subscription',
      action: 'subscription.create',
      actorId: user._id,
      actorRole: user.role,
      workspaceId: workspace._id,
      appId: workspace.gupshupAppId,
      subscriptionId: result?.subscription?.id || result?.subscriptionId,
      changeSet: {
        events,
        webhookMode: policySnapshot.effective.webhookMode,
        policySource: policySnapshot.effective.source,
      },
      after: {
        events,
        result,
      },
      req,
    });

    return NextResponse.json({ success: true, data: result, meta: { policy: serializePolicy(policySnapshot.effective) } });
  } catch (error: unknown) {
    const errorData = getErrorData(error);
    const status = getErrorStatus(error, 500);
    const message = getErrorMessage(error, 'Failed to create subscription');
    console.error("[SubscriptionsAPI] POST Error:", message, JSON.stringify(errorData));
    
    return NextResponse.json({ 
      success: false, 
      message,
      details: errorData 
    }, { status });
  }
});

/**
 * PUT /api/workspace/whatsapp/subscriptions
 * Update an existing subscription
 */
export const PUT = isSuperAdmin(async (req: NextRequest, { workspace, user }) => {
  await dbConnect();

  if (!workspace?._id) {
    return NextResponse.json({ success: false, message: 'No active workspace selected.' }, { status: 400 });
  }

  const policySnapshot = await resolveWebhookPolicy({
    workspaceId: String(workspace._id),
    appId: workspace.gupshupAppId ? String(workspace.gupshupAppId) : undefined,
  });

  if (!policySnapshot.effective.webhookEnabled) {
    return NextResponse.json(
      { success: false, message: 'Webhook subscriptions are disabled by super admin policy.' },
      { status: 403 }
    );
  }
  
  if (!workspace.gupshupAppId) {
    return NextResponse.json({ success: false, message: "No Gupshup App assigned" }, { status: 400 });
  }

  const { subscriptionId, tag, events: requestedEvents } = await req.json();

  if (!subscriptionId) {
    return NextResponse.json({ success: false, message: 'subscriptionId is required' }, { status: 400 });
  }

  let events: string[] = [];
  try {
    events = resolveSubscriptionModesForPolicy({
      requestedModes: Array.isArray(requestedEvents) ? requestedEvents : undefined,
      effectivePolicy: policySnapshot.effective,
      version: policySnapshot.effective.subscriptionVersion,
    });
  } catch (policyError: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(policyError, 'Subscription modes are blocked by policy.'),
        details: getErrorDetails(policyError),
      },
      { status: getErrorStatus(policyError, 400) }
    );
  }

  const { url } = buildWebhookUrl();

  if (!url) {
    return NextResponse.json(
      {
        success: false,
        message: 'A secure HTTPS APP_URL or webhook URL is required to configure subscriptions.',
      },
      { status: 400 }
    );
  }
  
  let beforeSubscription: unknown = null;
  try {
    beforeSubscription = await GupshupPartnerService.getSubscriptionById(workspace.gupshupAppId, subscriptionId);
  } catch {
    beforeSubscription = null;
  }

  try {
    const result = await GupshupPartnerService.updateSubscription({
      appId: workspace.gupshupAppId,
      subscriptionId,
      url,
      events,
      tag
    });

    await WebhookConfigAuditLog.logChange({
      scope: 'subscription',
      action: 'subscription.update',
      actorId: user._id,
      actorRole: user.role,
      workspaceId: workspace._id,
      appId: workspace.gupshupAppId,
      subscriptionId,
      changeSet: {
        events,
        tag,
        webhookMode: policySnapshot.effective.webhookMode,
        policySource: policySnapshot.effective.source,
      },
      before: beforeSubscription || undefined,
      after: {
        events,
        tag,
        result,
      },
      req,
    });

    return NextResponse.json({ success: true, data: result, meta: { policy: serializePolicy(policySnapshot.effective) } });
  } catch (error: unknown) {
    const errorData = getErrorData(error);
    const status = getErrorStatus(error, 500);
    const message = getErrorMessage(error, 'Failed to update subscription');
    console.error("[SubscriptionsAPI] PUT Error:", message, JSON.stringify(errorData));

    return NextResponse.json({ 
      success: false, 
      message,
      details: errorData
    }, { status });
  }
});

/**
 * DELETE /api/workspace/whatsapp/subscriptions
 * Remove one or all subscriptions
 */
export const DELETE = isSuperAdmin(async (req: NextRequest, { workspace, user }) => {
  await dbConnect();

  if (!workspace?._id) {
    return NextResponse.json({ success: false, message: 'No active workspace selected.' }, { status: 400 });
  }

  const policySnapshot = await resolveWebhookPolicy({
    workspaceId: String(workspace._id),
    appId: workspace.gupshupAppId ? String(workspace.gupshupAppId) : undefined,
  });

  if (!policySnapshot.effective.webhookEnabled) {
    return NextResponse.json(
      { success: false, message: 'Webhook subscriptions are disabled by super admin policy.' },
      { status: 403 }
    );
  }
  
  if (!workspace.gupshupAppId) {
    return NextResponse.json({ success: false, message: "No Gupshup App assigned" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get('id');

  try {
    const result = await GupshupPartnerService.deleteSubscription(
      workspace.gupshupAppId,
      subscriptionId || undefined
    );

    await WebhookConfigAuditLog.logChange({
      scope: 'subscription',
      action: subscriptionId ? 'subscription.delete' : 'subscription.delete-all',
      actorId: user._id,
      actorRole: user.role,
      workspaceId: workspace._id,
      appId: workspace.gupshupAppId,
      subscriptionId: subscriptionId || undefined,
      changeSet: {
        subscriptionId: subscriptionId || null,
        policySource: policySnapshot.effective.source,
      },
      req,
    });

    return NextResponse.json({ success: true, data: result, meta: { policy: serializePolicy(policySnapshot.effective) } });
  } catch (error: unknown) {
    const status = getErrorStatus(error, 500);
    const message = getErrorMessage(error, 'Failed to delete subscription');
    console.error("[SubscriptionsAPI] DELETE Error:", message);
    return NextResponse.json({ success: false, message }, { status });
  }
});
