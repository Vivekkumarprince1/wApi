import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Workspace } from '../models';
import crypto from 'crypto';

export const developerController = {
  /**
   * Get developer settings (webhooks & api keys count)
   */
  async getDeveloperSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const workspace = await (Workspace as any).findById(workspaceId).select('webhookSubscriptions apiKeys').lean();
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }
      res.json({ 
        success: true, 
        data: {
          webhooks: (workspace as any).webhookSubscriptions || [],
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
      const workspaceId = req.workspace?.id || req.workspace?._id;
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

  /**
   * Get all API keys
   */
  async getApiKeys(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const workspace = await (Workspace as any).findById(workspaceId).select('apiKeys').lean();
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }
      const keys = ((workspace as any).apiKeys || []).map((k: any) => ({
        id: k._id,
        name: k.name,
        key: k.key ? `${k.key.substring(0, 8)}...` : null, // Mask key for list
        isActive: k.isActive,
        createdAt: k.createdAt
      }));
      res.json({ success: true, data: keys });
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
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const key = `wapi_${crypto.randomBytes(24).toString('hex')}`;
      
      const workspace = await (Workspace as any).findByIdAndUpdate(
        workspaceId,
        {
          $push: {
            apiKeys: {
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
      const workspaceId = req.workspace?.id || req.workspace?._id;
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
