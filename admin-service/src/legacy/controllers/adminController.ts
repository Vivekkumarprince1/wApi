import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import os from 'os';
import { randomUUID } from 'crypto';
import config from '../config/index.js';
import { User, Workspace, Plan, SystemSettings } from '../models/index.js';
import { AuthRequest } from '../middleware/businessAuth.js';
import { createAuthToken, setAuthCookie } from '../utils/authHelper.js';
import { publishAuditEvent } from '../services/kafkaService.js';
import type { AuditEventAction } from '@wapi/contracts';

/** Fire-and-forget audit event — never throws, never blocks HTTP response */
function emitAudit(
  req: AuthRequest,
  action: AuditEventAction,
  resource?: { type: string; id: string; name?: string },
  details?: Record<string, unknown>,
): void {
  const actorId = String(req.user?._id || 'system');
  void publishAuditEvent({
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    actorId,
    action,
    resource,
    details,
    ip: (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip ?? undefined,
    userAgent: req.headers['user-agent'] ?? undefined,
  });
}

const INTERNAL_HEADERS = {
  'x-internal-service-secret': config.internalServiceSecret,
  'x-internal-service': 'auth-service',
  'content-type': 'application/json'
};

function jsonError(res: express.Response, status: number, message: string, error?: any) {
  return res.status(status).json({ success: false, message, error: error?.message || error });
}

async function proxyJson(req: express.Request, res: express.Response, baseUrl: string, path: string) {
  const target = `${baseUrl.replace(/\/$/, '')}${path}`;
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const finalTarget = `${target}${queryString}`;

  const response = await fetch(finalTarget, {
    method: req.method,
    headers: {
      ...INTERNAL_HEADERS,
      'x-user-id': String((req as AuthRequest).user?._id || ''),
      'x-user-role': String((req as AuthRequest).role || 'owner'),
      'x-user-system-role': String((req as AuthRequest).user?.role || ''),
      'x-workspace-id': String((req as AuthRequest).workspace?._id || req.params.id || ''),
    },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body || {})
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return res.status(response.status).send(body);
}

export const adminController = {
  async listWorkspaces(_req: AuthRequest, res: express.Response) {
    try {
      const workspaces = await Workspace.find({})
        .populate('owner', 'name email')
        .populate('plan', 'name slug features limits isActive')
        .sort({ createdAt: -1 });
      return res.json(workspaces);
    } catch (err: any) {
      return jsonError(res, 500, 'Server Error', err);
    }
  },

  async getWorkspace(req: AuthRequest, res: express.Response) {
    try {
      const workspace = await Workspace.findById(req.params.id)
        .populate('owner', 'name email')
        .populate('plan');
      if (!workspace) return jsonError(res, 404, 'Workspace not found');
      return res.json({ success: true, data: workspace });
    } catch (err: any) {
      return jsonError(res, 500, 'Server Error', err);
    }
  },

  async listUsers(req: AuthRequest, res: express.Response) {
    try {
      const filter = req.query.workspace ? { workspace: req.query.workspace } : {};
      const users = await User.find(filter).select('-passwordHash').populate('workspace', 'name').sort({ createdAt: -1 });
      return res.json(users.map((user: any) => {
        const obj = user.toObject();
        obj.status = obj.isDeactivated ? 'suspended' : (obj.lastLogin ? 'active' : 'invited');
        obj.lastActive = obj.lastLogin || obj.updatedAt || obj.createdAt;
        return obj;
      }));
    } catch (err: any) {
      return jsonError(res, 500, 'Server Error', err);
    }
  },

  async updateUserRole(req: AuthRequest, res: express.Response) {
    try {
      const { role } = req.body || {};
      const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-passwordHash');
      if (!user) return jsonError(res, 404, 'User not found');
      
      emitAudit(req, 'USER_ROLE_UPDATE', { type: 'User', id: String(user._id), name: user.email }, { newRole: role });

      return res.json({ success: true, data: user });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to update user role', err);
    }
  },

  async updateUserStatus(req: AuthRequest, res: express.Response) {
    try {
      const { status, isDeactivated } = req.body || {};
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { status, isDeactivated: typeof isDeactivated === 'boolean' ? isDeactivated : status === 'suspended' },
        { new: true }
      ).select('-passwordHash');
      if (!user) return jsonError(res, 404, 'User not found');

      emitAudit(req, 'USER_STATUS_UPDATE', { type: 'User', id: String(user._id), name: user.email }, { newStatus: status });

      return res.json({ success: true, data: user });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to update user status', err);
    }
  },

  async deleteUser(req: AuthRequest, res: express.Response) {
    try {
      if (String(req.user?._id) === req.params.id) return jsonError(res, 400, 'You cannot delete your own admin user');
      const user = await User.findById(req.params.id);
      if (!user) return jsonError(res, 404, 'User not found');
      
      if ((user as any).role === 'super_admin') {
        return res.status(403).json({ success: false, message: 'Cannot delete a superadmin user' });
      }

      await User.findByIdAndUpdate(req.params.id, { $set: { status: 'deleted', isDeactivated: true } });

      emitAudit(req, 'USER_DELETE', { type: 'User', id: String(user._id), name: user.email }, { deletedEmail: user.email });

      return res.json({ success: true, message: 'User deleted successfully' });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to delete user', err);
    }
  },

  async listPlans(_req: AuthRequest, res: express.Response) {
    try {
      const plans = await Plan.find().sort({ isActive: -1, monthlyBaseFeeCents: 1, price: 1 });
      return res.json({ success: true, data: plans });
    } catch (err: any) {
      return jsonError(res, 500, 'Server Error', err);
    }
  },

  async getPlan(req: AuthRequest, res: express.Response) {
    try {
      const plan = await Plan.findById(req.params.id);
      if (!plan) return jsonError(res, 404, 'Plan not found');
      return res.json({ success: true, data: plan });
    } catch (err: any) {
      return jsonError(res, 500, 'Server Error', err);
    }
  },

  async createPlan(req: AuthRequest, res: express.Response) {
    try {
      const plan = await Plan.create(req.body);

      emitAudit(req, 'PLAN_CREATE', { type: 'Plan', id: String(plan._id) }, { name: plan.name });

      return res.status(201).json({ success: true, data: plan });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to create plan', err);
    }
  },

  async updatePlan(req: AuthRequest, res: express.Response) {
    try {
      const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!plan) return jsonError(res, 404, 'Plan not found');

      emitAudit(req, 'PLAN_UPDATE', { type: 'Plan', id: String(plan._id) }, { updates: req.body });

      return res.json({ success: true, data: plan });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to update plan', err);
    }
  },

  async deletePlan(req: AuthRequest, res: express.Response) {
    try {
      const plan = await Plan.findByIdAndDelete(req.params.id);
      if (!plan) return jsonError(res, 404, 'Plan not found');

      emitAudit(req, 'PLAN_DELETE', { type: 'Plan', id: String(req.params.id) }, { name: plan.name });

      return res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to delete plan', err);
    }
  },

  async seedPlans(_req: AuthRequest, res: express.Response) {
    const defaultPlans = [
      { name: 'Free Tier', slug: 'free', monthlyBaseFeeCents: 0, currency: 'INR', isActive: true, isDefault: true },
      { name: 'Growth', slug: 'growth', monthlyBaseFeeCents: 499900, currency: 'INR', isActive: true },
      { name: 'Enterprise', slug: 'enterprise', monthlyBaseFeeCents: 1499900, currency: 'INR', isActive: true }
    ];
    const plans = [];
    for (const planData of defaultPlans) {
      plans.push(await Plan.findOneAndUpdate({ slug: planData.slug }, { $set: planData }, { upsert: true, new: true }));
    }
    return res.json({ success: true, message: 'Default plans initialized', plans });
  },

  async updateWorkspacePlan(req: AuthRequest, res: express.Response) {
    try {
      const { planId, billingStatus } = req.body || {};
      const workspace = await Workspace.findByIdAndUpdate(
        req.params.id,
        { plan: planId, billingStatus },
        { new: true }
      ).populate('plan');
      if (!workspace) return jsonError(res, 404, 'Workspace not found');
      return res.json({ success: true, data: workspace });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to update workspace plan', err);
    }
  },

  async deleteWorkspace(req: AuthRequest, res: express.Response) {
    try {
      const workspace = await Workspace.findByIdAndDelete(req.params.id);
      if (!workspace) return jsonError(res, 404, 'Workspace not found');

      emitAudit(req, 'WORKSPACE_DELETE', { type: 'Workspace', id: String(workspace._id), name: workspace.name });

      return res.json({ success: true, message: 'Workspace deleted successfully' });
    } catch (err: any) {
      return jsonError(res, 400, 'Failed to delete workspace', err);
    }
  },

  async getSettings(_req: AuthRequest, res: express.Response) {
    const settings = await (SystemSettings as any).getSettings();
    return res.json({ success: true, data: settings });
  },

  async updateSettings(req: AuthRequest, res: express.Response) {
    const settings = await (SystemSettings as any).findOneAndUpdate({}, { $set: req.body }, { upsert: true, new: true });
    
    emitAudit(req, 'SETTINGS_UPDATE', { type: 'SystemSettings', id: String(settings._id) }, { updates: req.body });

    return res.json({ success: true, data: settings });
  },

  async getStats(_req: AuthRequest, res: express.Response) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const db = mongoose.connection.db;
    const [totalUsers, totalWorkspaces, totalMessages30d, activeSubscriptions] = await Promise.all([
      User.countDocuments(),
      Workspace.countDocuments(),
      db?.collection('messages').countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isInternalNote: { $ne: true } }) || 0,
      Workspace.countDocuments({ billingStatus: { $in: ['active', 'trialing', undefined] } })
    ]);
    return res.json({
      success: true,
      data: { totalUsers, totalWorkspaces, totalMessages30d, activeSubscriptions }
    });
  },

  async listTemplates(_req: AuthRequest, res: express.Response) {
    const templates = await mongoose.connection.db?.collection('templates').find({}).sort({ createdAt: -1 }).limit(500).toArray();
    return res.json(templates || []);
  },

  async getAuditLogs(req: AuthRequest, res: express.Response) {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const logs = await mongoose.connection.db?.collection('auditlogs').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
    return res.json({ success: true, data: logs || [] });
  },

  async listCollections(_req: AuthRequest, res: express.Response) {
    const collections = await mongoose.connection.db?.listCollections().toArray();
    return res.json({ success: true, data: (collections || []).map((collection) => collection.name).sort() });
  },

  async fetchDocuments(req: AuthRequest, res: express.Response) {
    const { collectionName } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const documents = await mongoose.connection.db?.collection(String(collectionName)).find({}).limit(limit).toArray();
    return res.json({ success: true, data: documents || [] });
  },

  async updateDocument(req: AuthRequest, res: express.Response) {
    const { collectionName, id } = req.params;
    const result = await mongoose.connection.db?.collection(String(collectionName)).findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(String(id)) },
      { $set: req.body },
      { returnDocument: 'after' }
    );

    emitAudit(req, 'DATA_EXPLORER_UPDATE', { type: String(collectionName), id: String(id) }, { updates: req.body });

    return res.json({ success: true, data: result?.value || result });
  },

  async getInfrastructure(_req: AuthRequest, res: express.Response) {
    return res.json({
      success: true,
      data: {
        node: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        loadavg: os.loadavg(),
        cpus: os.cpus().length,
        dbState: mongoose.connection.readyState
      }
    });
  },

  async health(_req: AuthRequest, res: express.Response) {
    const services = [
      { name: 'auth-service', url: `http://127.0.0.1:${config.port}/health` },
      { name: 'billing-service', url: `${config.billingServiceUrl}/health` },
      { name: 'bsp-service', url: `${config.bspServiceUrl}/health` }
    ];
    const results = await Promise.all(services.map(async (service) => {
      try {
        const response = await fetch(service.url);
        return { name: service.name, status: response.ok ? 'up' : 'degraded' };
      } catch (err: any) {
        return { name: service.name, status: 'down', error: err.message };
      }
    }));
    return res.json({ success: true, services: results });
  },

  async impersonateWorkspace(req: AuthRequest, res: express.Response) {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return jsonError(res, 404, 'Workspace not found');
    const targetUser = await User.findOne({ workspace: workspace._id, role: 'owner' });
    if (!targetUser) return jsonError(res, 404, 'No owner found for this workspace');
    
    emitAudit(req, 'USER_IMPERSONATION', { type: 'User', id: String(targetUser._id), name: targetUser.email }, { targetEmail: targetUser.email, workspaceName: workspace.name });

    const token = jwt.sign(
      { id: String(targetUser._id), adminId: String(req.user?._id), isImpersonating: true },
      config.jwtSecret,
      { expiresIn: config.authTokenTtl as any }
    );
    setAuthCookie(res, token);
    return res.json({ success: true, message: `Session generated for ${targetUser.email}`, targetUrl: '/dashboard' });
  },

  async stopImpersonating(req: AuthRequest, res: express.Response) {
    const token = req.cookies?.[config.authCookieName];
    if (!token) return jsonError(res, 400, 'No active impersonation detected');
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (!decoded?.adminId) return jsonError(res, 400, 'No active impersonation detected');
    const adminUser = await User.findById(decoded.adminId);
    if (!adminUser) return jsonError(res, 404, 'Original identity not found');
    setAuthCookie(res, createAuthToken(adminUser));
    return res.json({ success: true, message: 'Returned to admin session', targetUrl: '/super-admin' });
  },

  async billingStats(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.billingServiceUrl, '/api/billing/wallets/admin/stats');
  },

  async listInvoices(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.billingServiceUrl, '/api/billing/wallets/admin/all-invoices');
  },

  async gupshupHealth(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/health');
  },

  async reconcileGupshup(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/reconcile');
  },

  async inviteUser(req: AuthRequest, res: express.Response) {
    try {
      const { name, email, role = 'agent', workspaceId } = req.body || {};
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });

      const user = await User.findOneAndUpdate(
        { email: String(email).toLowerCase() },
        {
          $setOnInsert: {
            name: name || String(email).split('@')[0],
            email: String(email).toLowerCase(),
            role,
            workspace: workspaceId || req.workspace?._id,
            status: 'invited'
          }
        },
        { upsert: true, new: true }
      ).select('-passwordHash');

      res.status(201).json({ success: true, data: user, user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getComplianceProfile(_req: AuthRequest, res: express.Response) {
    try {
      res.json({
        success: true,
        data: {
          businessVerificationMandatory: config.devAllowOtpWithoutEmail === false,
          provider: 'hybrid',
          webhookAuditEnabled: true,
          emergencyFreezeEnabled: true
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateComplianceProfile(req: AuthRequest, res: express.Response) {
    try {
      res.json({
        success: true,
        message: 'Compliance policy persisted by environment/config in this split backend.',
        data: req.body || {}
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async executeAction(req: AuthRequest, res: express.Response) {
    try {
      const { action, payload } = req.body || {};

      switch (action) {
        case 'broadcast': {
          const settings = await (SystemSettings as any).getSettings();
          settings.systemNotice = {
            message: payload?.message || '',
            level: payload?.level || 'info',
            active: true,
            updatedAt: new Date()
          };
          await settings.save();

          emitAudit(req, 'BROADCAST_NOTICE', undefined, { message: payload?.message });
          return res.json({ success: true, message: "Broadcast notice updated and persisted." });
        }
        case 'clear-cache': {
          const Redis = (await import('ioredis')).default;
          const redis = new (Redis as any)(config.redisUrl);
          await redis.flushall();
          redis.disconnect();
          return res.json({ success: true, message: "Platform cache purged successfully." });
        }
        case 'reconcile-wallet':
          return adminController.reconcileBilling(req, res);
        case 'maintenance-mode': {
          const settings = await (SystemSettings as any).getSettings();
          settings.maintenanceMode = !!payload?.enabled;
          settings.maintenanceMessage = payload?.message || settings.maintenanceMessage;
          settings.updatedBy = req.user?._id;
          await settings.save();
          
          return res.json({ 
            success: true, 
            message: `Maintenance mode ${settings.maintenanceMode ? 'enabled' : 'disabled'}.` 
          });
        }
        case 'set-business-verification-mandatory': {
          const enabled = typeof payload?.enabled === 'boolean'
            ? payload.enabled
            : String(payload?.enabled).toLowerCase() === 'true';
          const { setBusinessVerificationMandatory } = await import('../services/business/business-verification-policy-service.js');
          const updatedPolicy = await setBusinessVerificationMandatory(enabled, String(req.user?._id || ''), payload?.notes ? String(payload.notes) : undefined);
          return res.json({
            success: true,
            message: `Business verification policy ${enabled ? 'enabled' : 'disabled'}.`,
            policy: {
              businessVerificationMandatory: !!updatedPolicy?.mandatory,
              updatedAt: updatedPolicy?.updatedAt
            }
          });
        }
        case 'emergency-freeze': {
          const settings = await (SystemSettings as any).getSettings();
          settings.maintenanceMode = true;
          settings.maintenanceMessage = "CRITICAL SECURITY PROTOCOL ACTIVE: All platform operations have been suspended by system administrators.";
          await settings.save();

          const Redis = (await import('ioredis')).default;
          const redis = new (Redis as any)(config.redisUrl);
          await redis.flushall();
          redis.disconnect();

          emitAudit(req, 'SECURITY_EMERGENCY_FREEZE', { type: 'SYSTEM', id: 'global' }, { reason: payload?.reason || 'Manual emergency trigger' });

          return res.json({ 
            success: true, 
            message: "EMERGENCY PROTOCOL ACTIVATED: Maintenance enabled and all sessions purged." 
          });
        }
        default:
          return res.status(400).json({ success: false, message: `Unknown administrative action: ${action}` });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Failed to execute administrative action", error: err.message });
    }
  },

  async getControlPlane(req: AuthRequest, res: express.Response) {
    try {
      const { SuperAdminControlPlaneService } = await import('../services/super-admin/control-plane-service.js');
      const snapshot = await SuperAdminControlPlaneService.buildSnapshot();
      res.json({
        success: true,
        data: {
          manifest: {
            version: 1,
            generatedAt: new Date().toISOString()
          },
          snapshot
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to build control-plane snapshot', error: err.message });
    }
  },

  async reconcileBilling(req: AuthRequest, res: express.Response) {
    try {
      const response = await fetch(`${config.billingServiceUrl}/api/billing/wallets/admin/stats`, {
        headers: INTERNAL_HEADERS
      });
      const data = await response.json() as any;
      return res.json({
        success: true,
        data: {
          activeRevenue: data?.grossRevenue || 0,
          rechargeTransactions: 0,
          workspaceCount: await Workspace.countDocuments({})
        },
        message: 'Billing reconciliation snapshot generated'
      });
    } catch (err: any) {
      return jsonError(res, 500, 'Failed to reconcile billing', err);
    }
  },

  async getGupshupDeveloperConfig(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/developer-config');
  },

  async patchGupshupDeveloperConfig(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/developer-config');
  },

  async syncSpecificWebhook(req: AuthRequest, res: express.Response) {
    const { appId } = req.params;
    return proxyJson(req, res, config.bspServiceUrl, `/internal/v1/bsp/admin/sync-webhook/${appId}`);
  },

  async deleteGupshupSubscription(req: AuthRequest, res: express.Response) {
    const { appId, subscriptionId } = req.params;
    return proxyJson(req, res, config.bspServiceUrl, `/internal/v1/bsp/admin/subscription/${appId}/${subscriptionId}`);
  },

  async syncGupshupWebhooks(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/sync-webhooks');
  },

  async getWebhookStatus(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/webhook-status');
  },

  async getWebhookPolicies(req: AuthRequest, res: express.Response) {
    try {
      const { WebhookPolicy } = await import('../models/index.js');
      const policies = await WebhookPolicy.find({}).sort({ createdAt: -1 });
      res.json({ success: true, data: policies });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async saveWebhookPolicy(req: AuthRequest, res: express.Response) {
    try {
      const { id, ...data } = req.body;
      const { WebhookPolicy } = await import('../models/index.js');
      let policy;
      if (id) {
        policy = await WebhookPolicy.findByIdAndUpdate(id, data, { new: true });
      } else {
        policy = await WebhookPolicy.create(data);
      }
      emitAudit(req, id ? 'WEBHOOK_POLICY_UPDATE' : 'WEBHOOK_POLICY_CREATE', { type: 'WebhookPolicy', id: String(policy._id) }, { data });

      res.json({ success: true, data: policy });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getEntitlementDrift(req: AuthRequest, res: express.Response) {
    try {
      const [plans, workspaces] = await Promise.all([
        Plan.find({}).lean(),
        Workspace.find({}).populate('plan').lean(),
      ]);

      const planMap = new Map(plans.map((plan: any) => [String(plan._id), plan]));

      const drift = workspaces.map((workspace: any) => {
        const planId = workspace.plan?._id ? String(workspace.plan._id) : String(workspace.plan || '');
        const plan = workspace.plan?._id ? workspace.plan : planMap.get(planId) || null;
        const expectedFeatures = Array.isArray(plan?.features) ? plan.features : [];
        const currentFeatures = Array.isArray(workspace.plan?.features) ? workspace.plan.features : [];
        const missingFeatures = expectedFeatures.filter((feature: string) => !currentFeatures.includes(feature));
        const extraFeatures = currentFeatures.filter((feature: string) => !expectedFeatures.includes(feature));

        return {
          workspaceId: String(workspace._id),
          workspaceName: workspace.name,
          planName: plan?.name || 'Unassigned',
          missingFeatures,
          extraFeatures,
          driftScore: missingFeatures.length + extraFeatures.length,
        };
      });

      res.json({
        success: true,
        data: drift.filter((entry) => entry.driftScore > 0),
        summary: {
          scanned: drift.length,
          drifted: drift.filter((entry) => entry.driftScore > 0).length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async repairSubscriptions(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/reconcile');
  },

  async emergencyFreeze(req: AuthRequest, res: express.Response) {
    try {
      const { workspaceId, reason } = req.body;
      await Workspace.findByIdAndUpdate(workspaceId, { 
        billingStatus: 'frozen',
        'metadata.freezeReason': reason || 'Emergency admin action'
      });
      res.json({ success: true, message: "Workspace frozen" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async listWhatsAppRequests(req: AuthRequest, res: express.Response) {
    return proxyJson(req, res, config.bspServiceUrl, '/internal/v1/bsp/admin/esb-flow-list');
  }
};
