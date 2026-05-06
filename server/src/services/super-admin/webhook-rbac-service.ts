import { Types } from 'mongoose';
type UserRole = string;
import {
  WebhookPolicy,
  WEBHOOK_SUBSCRIPTION_MODES,
  type IWebhookPolicyDocument,
  type WebhookPolicyScope,
  type WebhookRuntimeMode,
  type WebhookSubscriptionMode
} from '../../models/super-admin/WebhookPolicy';

export interface EffectiveWebhookPolicy {
  source: 'default' | WebhookPolicyScope;
  scopeChain: Array<'default' | WebhookPolicyScope>;
  workspaceId?: string;
  appId?: string;
  webhookEnabled: boolean;
  webhookMode: WebhookRuntimeMode;
  defaultModes: WebhookSubscriptionMode[];
  allowedModes: WebhookSubscriptionMode[];
  statusViewRoles: UserRole[];
  subscriptionVersion: 3;
}

export interface WebhookPolicySnapshot {
  globalPolicy: IWebhookPolicyDocument | null;
  workspacePolicy: IWebhookPolicyDocument | null;
  appPolicy: IWebhookPolicyDocument | null;
  effective: EffectiveWebhookPolicy;
}

export interface UpsertWebhookPolicyInput {
  scope: WebhookPolicyScope;
  workspaceId?: string;
  appId?: string;
  webhookEnabled?: boolean;
  webhookMode?: WebhookRuntimeMode;
  defaultModes?: string[];
  allowedModes?: string[];
  statusViewRoles?: string[];
  notes?: string;
  updatedBy: string | Types.ObjectId;
}

export interface UpsertWebhookPolicyResult {
  policy: IWebhookPolicyDocument;
  effective: EffectiveWebhookPolicy;
}

const MODE_SET = new Set<string>(WEBHOOK_SUBSCRIPTION_MODES);

const ROLE_SET = new Set<UserRole>([
  'super_admin',
  'owner',
  'admin',
  'manager',
  'agent',
  'member',
  'viewer'
]);

const DEFAULT_POLICY: Omit<EffectiveWebhookPolicy, 'source' | 'scopeChain' | 'workspaceId' | 'appId'> = {
  webhookEnabled: true,
  webhookMode: 'production',
  defaultModes: ['MESSAGE', 'TEMPLATE', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
  allowedModes: [...WEBHOOK_SUBSCRIPTION_MODES],
  statusViewRoles: ['owner', 'admin', 'manager', 'agent', 'member', 'viewer'],
  subscriptionVersion: 3,
};

export const WEBHOOK_MODE_CATALOG: Record<WebhookSubscriptionMode, { v3Only: boolean; description: string }> = {
  NONE: {
    v3Only: false,
    description: 'No webhook mode is enabled.'
  },
  TEMPLATE: {
    v3Only: false,
    description: 'Template events are forwarded when TEMPLATE mode is subscribed.'
  },
  ACCOUNT: {
    v3Only: false,
    description: 'Account events are forwarded when ACCOUNT mode is subscribed.'
  },
  PAYMENTS: {
    v3Only: true,
    description: 'Incoming WhatsApp pay events are forwarded when PAYMENTS mode is subscribed.'
  },
  FLOWS_MESSAGE: {
    v3Only: true,
    description: 'Incoming flow messages are forwarded when FLOWS_MESSAGE mode is subscribed.'
  },
  MESSAGE: {
    v3Only: false,
    description: 'All incoming messages except flow messages are forwarded when MESSAGE mode is subscribed.'
  },
  OTHERS: {
    v3Only: true,
    description: 'Incoming events not covered by exclusive modes are forwarded when OTHERS mode is subscribed.'
  },
  ALL: {
    v3Only: true,
    description: 'All incoming messages are forwarded when ALL mode is subscribed.'
  },
  BILLING: {
    v3Only: false,
    description: 'Billing events are forwarded when BILLING mode is subscribed.'
  },
  FAILED: {
    v3Only: false,
    description: 'Failed events are forwarded when FAILED mode is subscribed.'
  },
  SENT: {
    v3Only: false,
    description: 'Sent events are forwarded when SENT mode is subscribed.'
  },
  DELIVERED: {
    v3Only: false,
    description: 'Delivered events are forwarded when DELIVERED mode is subscribed.'
  },
  READ: {
    v3Only: false,
    description: 'Read events are forwarded when READ mode is subscribed.'
  },
  ENQUEUED: {
    v3Only: false,
    description: 'Enqueued events are forwarded when ENQUEUED mode is subscribed.'
  },
  COEXISTENCE: {
    v3Only: false,
    description: 'Mobile app echoed events (smb_message_echoes) are forwarded when COEXISTENCE mode is subscribed.'
  },
  DELETED: {
    v3Only: false,
    description: 'Deleted events are forwarded when DELETED mode is subscribed.'
  }
};

export function getWebhookModeCatalog() {
  return WEBHOOK_SUBSCRIPTION_MODES.map((mode: any) => ({ mode, ...(WEBHOOK_MODE_CATALOG as any)[mode] }));
}

function createServiceError(message: string, status = 400, details?: Record<string, unknown>) {
  const error = new Error(message) as Error & { status?: number; details?: Record<string, unknown> };
  error.status = status;
  error.details = details;
  return error;
}

function asObjectId(input: string, fieldName: string) {
  if (!Types.ObjectId.isValid(input)) {
    throw createServiceError(`${fieldName} is invalid`, 400);
  }
  return new Types.ObjectId(input);
}

function normalizeModes(input: unknown) {
  const normalized: WebhookSubscriptionMode[] = [];
  const invalid: string[] = [];

  if (!Array.isArray(input)) {
    return { normalized, invalid };
  }

  for (const item of input) {
    const raw = String(item || '').trim().toUpperCase();
    if (!raw) continue;

    if (!MODE_SET.has(raw)) {
      invalid.push(raw);
      continue;
    }

    const mode = raw as WebhookSubscriptionMode;
    if (!normalized.includes(mode)) {
      normalized.push(mode);
    }
  }

  return { normalized, invalid };
}

function normalizeRoles(input: unknown) {
  const normalized: UserRole[] = [];
  const invalid: string[] = [];

  if (!Array.isArray(input)) {
    return { normalized, invalid };
  }

  for (const item of input) {
    const raw = String(item || '').trim().toLowerCase();
    if (!raw) continue;

    if (!ROLE_SET.has(raw as UserRole)) {
      invalid.push(raw);
      continue;
    }

    const role = raw as UserRole;
    if (!normalized.includes(role)) {
      normalized.push(role);
    }
  }

  return { normalized, invalid };
}

function enforceEffectiveConsistency(policy: EffectiveWebhookPolicy): EffectiveWebhookPolicy {
  const allowed = policy.allowedModes.length > 0 ? policy.allowedModes : [...DEFAULT_POLICY.allowedModes];
  const dedupAllowed = Array.from(new Set(allowed));

  let defaults = policy.defaultModes.length > 0 ? policy.defaultModes : [...DEFAULT_POLICY.defaultModes];
  defaults = defaults.filter((mode) => dedupAllowed.includes(mode));

  if (defaults.length === 0) {
    defaults = [...DEFAULT_POLICY.defaultModes].filter((mode) => dedupAllowed.includes(mode));
  }

  if (defaults.length === 0) {
    defaults = dedupAllowed.includes('MESSAGE') ? ['MESSAGE'] : [dedupAllowed[0]];
  }

  const statusRoles = policy.statusViewRoles.length > 0 ? policy.statusViewRoles : [...DEFAULT_POLICY.statusViewRoles];

  return {
    ...policy,
    allowedModes: dedupAllowed,
    defaultModes: Array.from(new Set(defaults)),
    statusViewRoles: Array.from(new Set(statusRoles)),
  };
}

function mergePolicyLayer(base: EffectiveWebhookPolicy, layer: IWebhookPolicyDocument | null) {
  if (!layer) return base;

  const next: EffectiveWebhookPolicy = {
    ...base,
    webhookEnabled: typeof layer.webhookEnabled === 'boolean' ? layer.webhookEnabled : base.webhookEnabled,
    webhookMode: layer.webhookMode || base.webhookMode,
    defaultModes: Array.isArray(layer.defaultModes) ? (layer.defaultModes as WebhookSubscriptionMode[]) : base.defaultModes,
    allowedModes: Array.isArray(layer.allowedModes) ? (layer.allowedModes as WebhookSubscriptionMode[]) : base.allowedModes,
    statusViewRoles: Array.isArray(layer.statusViewRoles) ? (layer.statusViewRoles as UserRole[]) : base.statusViewRoles,
  };

  return enforceEffectiveConsistency(next);
}

async function fetchPolicyDocuments(workspaceId?: string, appId?: string) {
  const workspaceObjectId = workspaceId ? asObjectId(workspaceId, 'workspaceId') : null;

  const [globalPolicy, workspacePolicy, appPolicy] = await Promise.all([
    WebhookPolicy.findOne({ scope: 'global' }),
    workspaceObjectId ? WebhookPolicy.findOne({ scope: 'workspace', workspace: workspaceObjectId }) : null,
    workspaceObjectId && appId
      ? WebhookPolicy.findOne({ scope: 'app', workspace: workspaceObjectId, appId: String(appId).trim() })
      : null,
  ]);

  return { globalPolicy, workspacePolicy, appPolicy };
}

export async function resolveWebhookPolicy(input: { workspaceId?: string; appId?: string }): Promise<WebhookPolicySnapshot> {
  const { workspaceId, appId } = input;
  const { globalPolicy, workspacePolicy, appPolicy } = await fetchPolicyDocuments(workspaceId, appId);

  let effective: EffectiveWebhookPolicy = {
    source: 'default',
    scopeChain: ['default'],
    workspaceId,
    appId,
    ...DEFAULT_POLICY,
  };

  if (globalPolicy) {
    effective = mergePolicyLayer(effective, globalPolicy);
    effective.source = 'global';
    effective.scopeChain = [...effective.scopeChain, 'global'];
  }

  if (workspacePolicy) {
    effective = mergePolicyLayer(effective, workspacePolicy);
    effective.source = 'workspace';
    effective.scopeChain = [...effective.scopeChain, 'workspace'];
  }

  if (appPolicy) {
    effective = mergePolicyLayer(effective, appPolicy);
    effective.source = 'app';
    effective.scopeChain = [...effective.scopeChain, 'app'];
  }

  return {
    globalPolicy,
    workspacePolicy,
    appPolicy,
    effective: enforceEffectiveConsistency(effective),
  };
}

function validateScopeInput(input: UpsertWebhookPolicyInput) {
  const scope = input.scope;

  if (!['global', 'workspace', 'app'].includes(scope)) {
    throw createServiceError('Invalid policy scope', 400);
  }

  if (scope === 'workspace' && !input.workspaceId) {
    throw createServiceError('workspaceId is required for workspace scope', 400);
  }

  if (scope === 'app' && (!input.workspaceId || !input.appId)) {
    throw createServiceError('workspaceId and appId are required for app scope', 400);
  }

  if (input.webhookMode && !['sandbox', 'production'].includes(input.webhookMode)) {
    throw createServiceError('webhookMode must be sandbox or production', 400);
  }
}

function buildSelector(scope: WebhookPolicyScope, workspaceId?: string, appId?: string) {
  if (scope === 'global') return { scope: 'global' as const };
  if (scope === 'workspace') return { scope: 'workspace' as const, workspace: asObjectId(String(workspaceId), 'workspaceId') };
  return {
    scope: 'app' as const,
    workspace: asObjectId(String(workspaceId), 'workspaceId'),
    appId: String(appId).trim()
  };
}

export async function upsertWebhookPolicy(input: UpsertWebhookPolicyInput): Promise<UpsertWebhookPolicyResult> {
  validateScopeInput(input);

  const scope = input.scope;
  const workspaceId = input.workspaceId ? String(input.workspaceId) : undefined;
  const appId = input.appId ? String(input.appId).trim() : undefined;

  const inherited =
    scope === 'global'
      ? {
          effective: {
            source: 'default' as const,
            scopeChain: ['default'] as Array<'default' | WebhookPolicyScope>,
            ...DEFAULT_POLICY,
          }
        }
      : scope === 'workspace'
        ? await resolveWebhookPolicy({})
        : await resolveWebhookPolicy({ workspaceId });

  const baseEffective = inherited.effective;

  const parsedAllowed = normalizeModes(input.allowedModes);
  const parsedDefault = normalizeModes(input.defaultModes);
  const parsedRoles = normalizeRoles(input.statusViewRoles);

  if (parsedAllowed.invalid.length > 0) {
    throw createServiceError('Unsupported modes found in allowedModes', 400, { invalidModes: parsedAllowed.invalid });
  }

  if (parsedDefault.invalid.length > 0) {
    throw createServiceError('Unsupported modes found in defaultModes', 400, { invalidModes: parsedDefault.invalid });
  }

  if (parsedRoles.invalid.length > 0) {
    throw createServiceError('Unsupported roles found in statusViewRoles', 400, { invalidRoles: parsedRoles.invalid });
  }

  const resolvedAllowedModes = parsedAllowed.normalized.length > 0 ? parsedAllowed.normalized : [...baseEffective.allowedModes];
  const resolvedDefaultModes = parsedDefault.normalized.length > 0 ? parsedDefault.normalized : [...baseEffective.defaultModes];
  const resolvedStatusRoles = parsedRoles.normalized.length > 0 ? parsedRoles.normalized : [...baseEffective.statusViewRoles];

  const blockedDefaults = resolvedDefaultModes.filter((mode) => !resolvedAllowedModes.includes(mode));
  if (blockedDefaults.length > 0) {
    throw createServiceError('defaultModes must be a subset of allowedModes', 400, { blockedDefaults });
  }

  const selector = buildSelector(scope, workspaceId, appId);

  const policy = await WebhookPolicy.findOneAndUpdate(
    selector,
    {
      $set: {
        scope,
        ...(scope !== 'global' ? { workspace: asObjectId(String(workspaceId), 'workspaceId') } : {}),
        ...(scope === 'app' ? { appId } : {}),
        webhookEnabled: typeof input.webhookEnabled === 'boolean' ? input.webhookEnabled : baseEffective.webhookEnabled,
        webhookMode: input.webhookMode || baseEffective.webhookMode,
        allowedModes: resolvedAllowedModes,
        defaultModes: resolvedDefaultModes,
        statusViewRoles: resolvedStatusRoles,
        notes: typeof input.notes === 'string' ? input.notes.trim() : undefined,
        updatedBy: input.updatedBy,
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  if (!policy) {
    throw createServiceError('Unable to save webhook policy', 500);
  }

  const effective = (await resolveWebhookPolicy({ workspaceId, appId })).effective;

  return { policy, effective };
}

export async function deleteWebhookPolicyOverride(input: {
  scope: 'workspace' | 'app';
  workspaceId: string;
  appId?: string;
}) {
  if (input.scope === 'app' && !input.appId) {
    throw createServiceError('appId is required to delete app override', 400);
  }

  const selector = buildSelector(input.scope, input.workspaceId, input.appId);
  const deleted = await WebhookPolicy.findOneAndDelete(selector);

  if (!deleted) {
    throw createServiceError('Policy override not found', 404);
  }

  const effective = (await resolveWebhookPolicy({
    workspaceId: input.workspaceId,
    appId: input.scope === 'app' ? input.appId : undefined,
  })).effective;

  return { deleted, effective };
}

export function canViewWebhookStatus(role: string, effectivePolicy: EffectiveWebhookPolicy) {
  if (role === 'super_admin') return true;
  return effectivePolicy.statusViewRoles.includes(role as UserRole);
}

export function resolveSubscriptionModesForPolicy(input: {
  requestedModes?: string[];
  effectivePolicy: EffectiveWebhookPolicy;
  version?: number;
}) {
  const version = input.version || 3;

  if (!input.effectivePolicy.webhookEnabled) {
    throw createServiceError('Webhook mode is disabled by super admin policy', 403);
  }

  const parsed = normalizeModes(input.requestedModes);
  if (parsed.invalid.length > 0) {
    throw createServiceError('Unsupported subscription modes', 400, { invalidModes: parsed.invalid });
  }

  const modes = parsed.normalized.length > 0 ? parsed.normalized : [...input.effectivePolicy.defaultModes];

  if (modes.includes('ALL') && modes.length > 1) {
    return ['ALL'] as WebhookSubscriptionMode[];
  }

  if (modes.includes('NONE') && modes.length > 1) {
    throw createServiceError('NONE mode cannot be combined with other modes', 400);
  }

  const hasWildcardAccess = input.effectivePolicy.allowedModes.includes('ALL');
  if (!hasWildcardAccess) {
    const blocked = modes.filter((mode) => !input.effectivePolicy.allowedModes.includes(mode));
    if (blocked.length > 0) {
      throw createServiceError('One or more modes are blocked by policy', 403, { blockedModes: blocked });
    }
  }

  if (version < 3) {
    const versionBlocked = modes.filter((mode) => WEBHOOK_MODE_CATALOG[mode]?.v3Only);
    if (versionBlocked.length > 0) {
      throw createServiceError('One or more requested modes are only supported for v3', 400, {
        blockedModes: versionBlocked,
      });
    }
  }

  return Array.from(new Set(modes));
}
