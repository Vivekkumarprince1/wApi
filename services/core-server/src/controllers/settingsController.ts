/**
 * Settings Controller
 * Handle workspace and user settings persistence
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Workspace, User } from '../models';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import * as SocketService from '../services/socket-service';

export const settingsController = {
  /**
   * Get workspace general settings
   */
  async getWorkspaceSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).select(
        'name avatar timezone language billing notifications preferences'
      );
      
      if (!workspace) throw new NotFoundError("Workspace not found");

      res.json({
        success: true,
        data: {
          name: workspace.name,
          avatar: (workspace as any).avatar,
          timezone: (workspace as any).timezone || 'UTC',
          language: (workspace as any).language || 'en',
          billing: (workspace as any).billing || {},
          notifications: (workspace as any).notifications || {},
          preferences: (workspace as any).preferences || {}
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update workspace general settings
   */
  async updateWorkspaceSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, avatar, timezone, language, preferences } = req.body;

      const workspace = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        {
          $set: {
            name: name || undefined,
            avatar: avatar || undefined,
            timezone: timezone || undefined,
            language: language || undefined,
            preferences: preferences || undefined
          }
        },
        { new: true }
      ).select('name avatar timezone language preferences');

      if (!workspace) throw new NotFoundError("Workspace not found");

      // Emit event for real-time update
      SocketService.emitWorkspaceSettingsUpdated(req.workspace._id, {
        name, avatar, timezone, language, preferences
      });

      res.json({
        success: true,
        data: workspace,
        message: "Settings updated successfully"
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get user notification preferences
   */
  async getUserNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.user._id).select(
        'notificationSettings timezone language'
      );

      if (!user) throw new NotFoundError("User not found");

      res.json({
        success: true,
        data: {
          notificationSettings: (user as any).notificationSettings || {
            emailNotifications: true,
            smsNotifications: false,
            pushNotifications: true,
            dailyDigest: false,
            marketingEmails: false
          },
          timezone: (user as any).timezone || 'UTC',
          language: (user as any).language || 'en'
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update user notification preferences
   */
  async updateUserNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { notificationSettings } = req.body;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { notificationSettings } },
        { new: true }
      ).select('notificationSettings');

      if (!user) throw new NotFoundError("User not found");

      res.json({
        success: true,
        data: user,
        message: "Notification settings updated"
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get billing settings
   */
  async getBillingSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).select(
        'plan billingEmail billingAddress billingPhone billingStatus'
      ).populate('plan', 'name slug price features');

      if (!workspace) throw new NotFoundError("Workspace not found");

      res.json({
        success: true,
        data: {
          plan: workspace.plan,
          billingEmail: (workspace as any).billingEmail,
          billingAddress: (workspace as any).billingAddress,
          billingPhone: (workspace as any).billingPhone,
          billingStatus: (workspace as any).billingStatus || 'active'
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update billing settings
   */
  async updateBillingSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { billingEmail, billingAddress, billingPhone } = req.body;

      const workspace = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        {
          $set: {
            billingEmail: billingEmail || undefined,
            billingAddress: billingAddress || undefined,
            billingPhone: billingPhone || undefined
          }
        },
        { new: true }
      ).select('billingEmail billingAddress billingPhone');

      if (!workspace) throw new NotFoundError("Workspace not found");

      res.json({
        success: true,
        data: workspace,
        message: "Billing settings updated"
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get integrations settings
   */
  async getIntegrationsSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { Integration } = await import('../models');
      
      const integrations = await Integration.find({
        workspace: req.workspace._id
      }).select('type isActive lastSyncAt config -config'); // Exclude sensitive config

      res.json({
        success: true,
        data: integrations.map(int => ({
          _id: int._id,
          type: int.type,
          isActive: (int as any).status === 'connected' || (int as any).webhookConfig?.isActive,
          lastSyncAt: (int as any).lastSyncAt
        }))
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get API keys
   */
  async getApiKeys(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id);
      
      if (!workspace) throw new NotFoundError("Workspace not found");

      const keys = (workspace as any).apiKeys || [];
      
      res.json({
        success: true,
        data: keys.map((key: any) => ({
          id: key.id,
          name: key.name,
          prefix: key.key.substring(0, 8) + '...',
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          isActive: key.isActive
        }))
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create new API key
   */
  async createApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }

      const crypto = require('crypto');
      const apiKey = 'wapi_' + crypto.randomBytes(32).toString('hex');
      const id = crypto.randomBytes(8).toString('hex');

      const workspace = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        {
          $push: {
            apiKeys: {
              id,
              name,
              key: apiKey,
              createdAt: new Date(),
              isActive: true
            }
          }
        },
        { new: true }
      );

      if (!workspace) throw new NotFoundError("Workspace not found");

      res.status(201).json({
        success: true,
        data: {
          id,
          name,
          key: apiKey, // Only shown once at creation
          createdAt: new Date()
        },
        message: "API key created. Save this key securely!"
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Revoke API key
   */
  async revokeApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { keyId } = req.params;

      const workspace = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        {
          $set: {
            'apiKeys.$[elem].isActive': false,
            'apiKeys.$[elem].revokedAt': new Date()
          }
        },
        {
          arrayFilters: [{ 'elem.id': keyId }],
          new: true
        }
      );

      if (!workspace) throw new NotFoundError("Workspace not found");

      res.json({
        success: true,
        message: "API key revoked"
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get team settings
   */
  async getTeamSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { Permission } = await import('../models');
      
      const members = await Permission.find({
        workspace: req.workspace._id,
        isActive: true
      }).populate('user', 'name email avatar lastLogin');

      res.json({
        success: true,
        data: members
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update team member role
   */
  async updateTeamMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!['owner', 'admin', 'manager', 'agent', 'viewer'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
      }

      const { Permission } = await import('../models');
      
      const permission = await Permission.findOneAndUpdate(
        { workspace: req.workspace._id, user: userId },
        { $set: { role } },
        { new: true }
      ).populate('user', 'name email');

      if (!permission) throw new NotFoundError("Member not found");

      res.json({
        success: true,
        data: permission,
        message: "Member role updated"
      });
    } catch (err) {
      next(err);
    }
  }
};
