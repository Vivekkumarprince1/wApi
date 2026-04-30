import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { isSuperAdmin } from '@/lib/middlewares/auth';
import { WebhookConfigAuditLog } from '@/lib/models';
import {
  getWebhookModeCatalog,
  resolveWebhookPolicy,
  upsertWebhookPolicy,
  deleteWebhookPolicyOverride,
  type UpsertWebhookPolicyInput,
} from '@/lib/services/super-admin/webhook-rbac-service';

type PolicyLike = {
  _id: unknown;
  scope?: unknown;
  workspace?: unknown;
  appId?: unknown;
  webhookEnabled?: unknown;
  webhookMode?: unknown;
  defaultModes?: unknown;
  allowedModes?: unknown;
  statusViewRoles?: unknown;
  notes?: unknown;
  updatedBy?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

function getErrorMeta(error: unknown) {
  const root = asRecord(error);
  const status = typeof root?.status === 'number' ? root.status : 500;
  const message = typeof root?.message === 'string' ? root.message : 'Request failed';
  const details = root?.details;
  return { status, message, details };
}

function policyToJson(policy: PolicyLike | null | undefined) {
  if (!policy) return null;

  return {
    id: String(policy._id),
    scope: policy.scope,
    workspaceId: policy.workspace ? String(policy.workspace) : undefined,
    appId: policy.appId || undefined,
    webhookEnabled: policy.webhookEnabled,
    webhookMode: policy.webhookMode,
    defaultModes: Array.isArray(policy.defaultModes) ? policy.defaultModes : [],
    allowedModes: Array.isArray(policy.allowedModes) ? policy.allowedModes : [],
    statusViewRoles: Array.isArray(policy.statusViewRoles) ? policy.statusViewRoles : [],
    notes: policy.notes || undefined,
    updatedBy: policy.updatedBy ? String(policy.updatedBy) : undefined,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

export const GET = isSuperAdmin(async (req: NextRequest) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const appId = searchParams.get('appId') || undefined;

    const snapshot = await resolveWebhookPolicy({ workspaceId, appId });

    return NextResponse.json({
      success: true,
      data: {
        globalPolicy: policyToJson(snapshot.globalPolicy),
        workspacePolicy: policyToJson(snapshot.workspacePolicy),
        appPolicy: policyToJson(snapshot.appPolicy),
        effectivePolicy: snapshot.effective,
        modeCatalog: getWebhookModeCatalog(),
      },
    });
  } catch (error: unknown) {
    const { status, message, details } = getErrorMeta(error);
    return NextResponse.json(
      {
        success: false,
        message,
        details,
      },
      { status }
    );
  }
});

export const PUT = isSuperAdmin(async (req: NextRequest, { user }) => {
  try {
    await dbConnect();

    const body = await req.json();

    const scope = String(body.scope || '').toLowerCase();
    const workspaceId = body.workspaceId ? String(body.workspaceId) : undefined;
    const appId = body.appId ? String(body.appId) : undefined;

    const beforeSnapshot = await resolveWebhookPolicy({ workspaceId, appId });

    const result = await upsertWebhookPolicy({
      scope: scope as UpsertWebhookPolicyInput['scope'],
      workspaceId,
      appId,
      webhookEnabled: typeof body.webhookEnabled === 'boolean' ? body.webhookEnabled : undefined,
      webhookMode: body.webhookMode,
      defaultModes: Array.isArray(body.defaultModes) ? body.defaultModes : undefined,
      allowedModes: Array.isArray(body.allowedModes) ? body.allowedModes : undefined,
      statusViewRoles: Array.isArray(body.statusViewRoles) ? body.statusViewRoles : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      updatedBy: user._id,
    });

    await WebhookConfigAuditLog.logChange({
      scope: scope === 'global' ? 'global' : scope === 'workspace' ? 'workspace' : 'app',
      action: 'webhook-policy.upsert',
      actorId: user._id,
      actorRole: user.role,
      workspaceId,
      appId,
      changeSet: {
        scope,
        webhookEnabled: body.webhookEnabled,
        webhookMode: body.webhookMode,
        defaultModes: body.defaultModes,
        allowedModes: body.allowedModes,
        statusViewRoles: body.statusViewRoles,
      },
      before: beforeSnapshot.effective,
      after: result.effective,
      req,
    });

    return NextResponse.json({
      success: true,
      data: {
        policy: policyToJson(result.policy),
        effectivePolicy: result.effective,
      },
    });
  } catch (error: unknown) {
    const { status, message, details } = getErrorMeta(error);
    return NextResponse.json(
      {
        success: false,
        message,
        details,
      },
      { status }
    );
  }
});

export const DELETE = isSuperAdmin(async (req: NextRequest, { user }) => {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);

    const scope = String(body.scope || searchParams.get('scope') || '').toLowerCase();
    const workspaceId = String(body.workspaceId || searchParams.get('workspaceId') || '');
    const appId = String(body.appId || searchParams.get('appId') || '').trim() || undefined;

    if (!scope || !workspaceId) {
      return NextResponse.json(
        {
          success: false,
          message: 'scope and workspaceId are required to delete an override',
        },
        { status: 400 }
      );
    }

    if (scope === 'global') {
      return NextResponse.json(
        {
          success: false,
          message: 'Global policy cannot be deleted. Update it instead.',
        },
        { status: 400 }
      );
    }

    const beforeSnapshot = await resolveWebhookPolicy({ workspaceId, appId });

    const result = await deleteWebhookPolicyOverride({
      scope: scope as 'workspace' | 'app',
      workspaceId,
      appId,
    });

    await WebhookConfigAuditLog.logChange({
      scope: scope === 'workspace' ? 'workspace' : 'app',
      action: 'webhook-policy.delete-override',
      actorId: user._id,
      actorRole: user.role,
      workspaceId,
      appId,
      changeSet: {
        scope,
        workspaceId,
        appId,
      },
      before: beforeSnapshot.effective,
      after: result.effective,
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook policy override deleted',
      data: {
        deletedPolicy: policyToJson(result.deleted),
        effectivePolicy: result.effective,
      },
    });
  } catch (error: unknown) {
    const { status, message, details } = getErrorMeta(error);
    return NextResponse.json(
      {
        success: false,
        message,
        details,
      },
      { status }
    );
  }
});
