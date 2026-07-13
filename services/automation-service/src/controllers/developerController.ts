import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Workspace } from '../models';
import crypto from 'crypto';
import mongoose from 'mongoose';

const DEFAULT_OUTBOUND_EVENTS = ['auth.template.sent', 'auth.otp.sent'];

function workspaceIdFrom(req: AuthRequest) {
  return req.workspace?.id || req.workspace?._id;
}

function normalizeWebhookUrl(raw: unknown) {
  return String(raw || '').trim();
}

function isAllowedWebhookUrl(raw: unknown) {
  const value = normalizeWebhookUrl(raw);
  if (!value) return false;

  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return true;
  } catch {
    return false;
  }

  return false;
}

function normalizeEvents(raw: unknown): string[] {
  const events = Array.isArray(raw) ? raw : DEFAULT_OUTBOUND_EVENTS;
  const normalized = events
    .map((event) => String(event || '').trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function publicWebhook(webhook: any) {
  if (!webhook) return webhook;
  const obj = typeof webhook.toObject === 'function' ? webhook.toObject() : webhook;
  return {
    ...obj,
    id: obj.id || obj._id?.toString?.() || obj._id,
  };
}

export const developerController = {
  /**
   * Get developer settings (webhooks & api keys count)
   */
  async getDeveloperSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const workspace = await (Workspace as any).findById(workspaceId).select('webhookSubscriptions apiKeys').lean();
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }
      res.json({ 
        success: true, 
        data: {
          webhooks: ((workspace as any).webhookSubscriptions || []).map(publicWebhook),
          apiKeysCount: (workspace as any).apiKeys?.length || 0
        } 
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update developer settings (like webhook status)
   */
  async updateDeveloperSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const updated = await (Workspace as any).findByIdAndUpdate(
        workspaceId,
        { $set: req.body },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }
      res.json({ success: true, workspace: updated });
    } catch (err) {
      next(err);
    }
  },

  async listOutboundWebhooks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const workspace = await (Workspace as any).findById(workspaceId).select('webhookSubscriptions').lean();
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      res.json({
        success: true,
        data: {
          webhooks: ((workspace as any).webhookSubscriptions || []).map(publicWebhook)
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async createOutboundWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const url = normalizeWebhookUrl(req.body?.url);

      if (!isAllowedWebhookUrl(url)) {
        return res.status(400).json({
          success: false,
          message: "A valid HTTPS webhook URL is required. Localhost HTTP URLs are allowed in development."
        });
      }

      const webhook = {
        name: String(req.body?.name || 'Outbound Endpoint').trim(),
        url,
        events: normalizeEvents(req.body?.events),
        secret: `whsec_${crypto.randomBytes(24).toString('hex')}`,
        isActive: req.body?.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const workspace = await (Workspace as any).findByIdAndUpdate(
        workspaceId,
        { $push: { webhookSubscriptions: webhook } },
        { new: true }
      );

      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      const created = workspace.webhookSubscriptions?.[workspace.webhookSubscriptions.length - 1];
      res.status(201).json({ success: true, data: publicWebhook(created) });
    } catch (err) {
      next(err);
    }
  },

  async updateOutboundWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const { id } = req.params;
      const $set: Record<string, unknown> = {
        'webhookSubscriptions.$.updatedAt': new Date()
      };

      if (req.body?.url !== undefined) {
        const url = normalizeWebhookUrl(req.body.url);
        if (!isAllowedWebhookUrl(url)) {
          return res.status(400).json({
            success: false,
            message: "A valid HTTPS webhook URL is required. Localhost HTTP URLs are allowed in development."
          });
        }
        $set['webhookSubscriptions.$.url'] = url;
      }

      if (req.body?.events !== undefined) {
        $set['webhookSubscriptions.$.events'] = normalizeEvents(req.body.events);
      }

      if (req.body?.name !== undefined) {
        $set['webhookSubscriptions.$.name'] = String(req.body.name || 'Outbound Endpoint').trim();
      }

      if (req.body?.isActive !== undefined) {
        $set['webhookSubscriptions.$.isActive'] = Boolean(req.body.isActive);
      }

      const workspace = await (Workspace as any).findOneAndUpdate(
        { _id: workspaceId, 'webhookSubscriptions._id': id },
        { $set },
        { new: true }
      );

      if (!workspace) {
        return res.status(404).json({ success: false, message: "Webhook endpoint not found" });
      }

      const updated = workspace.webhookSubscriptions?.id(id);
      res.json({ success: true, data: publicWebhook(updated) });
    } catch (err) {
      next(err);
    }
  },

  async deleteOutboundWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const { id } = req.params;
      const workspace = await (Workspace as any).findByIdAndUpdate(
        workspaceId,
        { $pull: { webhookSubscriptions: { _id: id } } },
        { new: true }
      );

      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      res.json({ success: true, data: { deleted: true, id } });
    } catch (err) {
      next(err);
    }
  },

  async clearOutboundWebhooks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const workspace = await (Workspace as any).findByIdAndUpdate(
        workspaceId,
        { $set: { webhookSubscriptions: [] } },
        { new: true }
      );

      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get all API keys
   */
  async getApiKeys(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = workspaceIdFrom(req);
      const workspace = await (Workspace as any).findById(workspaceId).select('apiKeys').lean();
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }
      const keys = ((workspace as any).apiKeys || []).map((k: any) => ({
        id: k._id,
        name: k.name,
        key: k.key ? `${k.key.substring(0, 8)}...` : null, // Mask key for list
        isActive: k.isActive,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt
      }));
      res.json({ success: true, data: keys });
    } catch (err) {
      next(err);
    }
  },

  async revealApiKeySecret(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = workspaceIdFrom(req);
      const workspace = await (Workspace as any).findOne(
        { _id: workspaceId, 'apiKeys._id': id },
        { 'apiKeys.$': 1 }
      ).lean();

      const apiKey = (workspace as any)?.apiKeys?.[0];
      if (!apiKey?.key) {
        return res.status(404).json({ success: false, message: "API key not found" });
      }

      res.json({
        success: true,
        data: {
          id: apiKey._id?.toString?.() || id,
          name: apiKey.name,
          key: apiKey.key,
          isActive: apiKey.isActive !== false,
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create a new API Key
   */
  async createApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const workspaceId = workspaceIdFrom(req);
      const key = `wapi_${crypto.randomBytes(24).toString('hex')}`;
      const keyId = new mongoose.Types.ObjectId();
      
      const workspace = await (Workspace as any).findByIdAndUpdate(
        workspaceId,
        {
          $push: {
            apiKeys: {
              _id: keyId,
              name: name || "New API Key",
              key,
              isActive: true,
              createdAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      res.status(201).json({ 
        success: true, 
        data: {
          id: keyId.toString(),
          name: name || "New API Key",
          key, // Return full key once on creation
          isActive: true
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Revoke an API Key
   */
  async revokeApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = workspaceIdFrom(req);
      const workspace = await (Workspace as any).findByIdAndUpdate(
        workspaceId,
        {
          $pull: {
            apiKeys: { _id: id }
          }
        },
        { new: true }
      );
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }
      res.json({ success: true, message: "API key revoked" });
    } catch (err) {
      next(err);
    }
  }
};
