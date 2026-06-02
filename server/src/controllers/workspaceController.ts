import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Workspace, User, Team, Permission, WorkspaceInvitation, Role } from '../models';
import { NotFoundError, ApiError, ForbiddenError, BadRequestError } from '../utils/errors';
import { config } from '../config';
import { proxyController } from './proxyController';
import { logActivity } from '../services/activity-logging-service';
import crypto from 'crypto';
import { Types } from 'mongoose';

export const workspaceController = {
  /**
   * Get workspace pricing
   */
  async getPricing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace._id.toString();
      const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'] as const;
      const pricing: Record<string, number> = {};

      for (const category of categories) {
        try {
          const response = await proxyController.forwardToService('billing', {
            method: 'GET',
            path: `/api/billing/wallets/${workspaceId}/pricing`,
            params: { category },
            workspaceId
          });
          pricing[category] = response.data.cost;
        } catch {
          pricing[category] = 0;
        }
      }

      res.json({
        success: true,
        data: pricing,
        currency: (req.workspace as any)?.wallet?.currency || 'INR'
      });
    } catch (err) {
      next(err);
    }
  },
  /**
   * Get Current Workspace Settings
   */
  async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).populate('plan');
      if (!workspace) throw new NotFoundError("Workspace not found");
      res.json({ success: true, workspace });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update Workspace Settings
   */
  async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        { $set: req.body },
        { new: true }
      );
      await logActivity(req, 'update', 'workspace', {
        entityName: updated?.name,
        status: 'success'
      });
      res.json({ success: true, workspace: updated });
    } catch (err) {
      next(err);
    }
  },

  async updateBusinessInfo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const {
        name,
        industry,
        companySize,
        website,
        address,
        city,
        state,
        country,
        zipCode,
        description,
        businessDocuments
      } = req.body || {};

      const updated = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        {
          $set: {
            ...(name ? { name } : {}),
            industry,
            companySize,
            website,
            address,
            city,
            state,
            country,
            zipCode,
            description,
            ...(businessDocuments ? { businessDocuments: { ...(req.workspace.businessDocuments || {}), ...businessDocuments } } : {}),
            'onboarding.businessInfoCompleted': true,
            'onboarding.businessInfoCompletedAt': new Date()
          }
        },
        { new: true }
      );

      res.json({ success: true, message: "Business information updated successfully", workspace: updated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * List Team Members (Agents)
   * Enhanced to discover agents from both Permission records AND Team memberships
   */
  async listTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace._id;
      const { Conversation, Team, Permission } = await import('../models');

      // 1. Get all permission records (Primary source)
      const memberships = await Permission.find({ 
        workspace: workspaceId,
        isActive: { $ne: false } 
      })
      .populate('user', 'name email role lastLogin phone status')
      .sort({ createdAt: -1 })
      .lean();

      // 2. Get all teams to find members who might be missing from permissions (Secondary source)
      const allTeams = await Team.find({ workspace: workspaceId, isActive: true })
        .populate('members.user', 'name email role status')
        .lean();

      const agentsMap = new Map();

      // Process Permission-based members
      memberships.forEach((m: any) => {
        if (m.user) {
          agentsMap.set(m.user._id.toString(), {
            ...m.user,
            role: m.role || m.user.role,
            isOnline: m.isOnline || false,
            isAvailable: m.isAvailable || false,
            lastSeenAt: m.lastSeenAt || null,
            openConversations: 0, // Will populate below
            teams: [] // Will populate below
          });
        }
      });

      // Process Team-based members to ensure everyone is caught
      allTeams.forEach((team: any) => {
        team.members?.forEach((m: any) => {
          if (m.user) {
            const userIdStr = m.user._id.toString();
            if (!agentsMap.has(userIdStr)) {
              agentsMap.set(userIdStr, {
                ...m.user,
                role: m.role || 'member',
                isOnline: false,
                isAvailable: false,
                openConversations: 0,
                teams: []
              });
            }
            // Add team info to agent
            agentsMap.get(userIdStr).teams.push({ _id: team._id, name: team.name });
          }
        });
      });

      // 3. Populate Open Conversation counts for all discovered agents
      const agentIds = Array.from(agentsMap.keys());
      const openCounts = await Conversation.aggregate([
        { $match: { 
          workspace: workspaceId, 
          assignedTo: { $in: agentIds.map(id => new Types.ObjectId(id)) },
          status: { $in: ['open', 'pending'] } 
        }},
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
      ]);

      const countsMap = new Map(openCounts.map(c => [c._id.toString(), c.count]));
      
      const finalAgents = Array.from(agentsMap.values()).map(agent => ({
        ...agent,
        openConversations: countsMap.get(agent._id.toString()) || 0
      }));

      const pendingInvites = await WorkspaceInvitation.find({
        workspace: workspaceId,
        status: 'pending'
      }).lean();

      const invitations = pendingInvites.map((inv: any) => ({
        id: inv._id,
        _id: inv._id,
        email: inv.email,
        name: inv.name,
        phone: inv.phone || '',
        role: inv.role,
        status: 'pending',
        invitedAt: inv.createdAt,
        expiresAt: inv.expiresAt
      }));

      res.json({
        success: true,
        data: {
          members: finalAgents.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
          invitations
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getMemberRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const memberId = req.params.memberId || req.params.id;
      const [user, invitation, permission] = await Promise.all([
        User.findById(memberId).select('-passwordHash').lean(),
        WorkspaceInvitation.findOne({ _id: memberId, workspace: req.workspace._id }).lean().catch(() => null),
        Permission.findOne({ user: memberId, workspace: req.workspace._id }).lean().catch(() => null)
      ]);

      const member = user || invitation;
      if (!member) throw new NotFoundError("Team member or invitation not found");
      res.json({ success: true, data: { ...member, permission } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Switch Active Workspace
   */
  async switchWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.body;
      const userId = req.user._id;

      const membership = await Permission.findOne({ workspace: workspaceId, user: userId });
      if (!membership) throw new ForbiddenError("You are not a member of this workspace");

      await User.findByIdAndUpdate(userId, { activeWorkspace: workspaceId });
      res.json({ success: true, message: "Workspace switched successfully" });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get WABA Settings
   */
  async getWABASettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id);
      res.json({
        success: true,
        waba: {
          whatsappPhoneNumberId: workspace?.bspPhoneNumberId,
          whatsappVerifyToken: workspace?.whatsappVerifyToken, 
          wabaId: workspace?.wabaId,
          businessAccountId: workspace?.businessAccountId,
          hasToken: !!workspace?.whatsappAccessToken,
          connectedAt: workspace?.bspLastSyncedAt,
          phoneStatus: workspace?.bspPhoneStatus
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get WABA Subscription Status from Gupshup
   */
  async getWABASubscriptionStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).select('gupshupAppId gupshupIdentity').lean();
      const appId = (workspace as any)?.gupshupAppId || (workspace as any)?.gupshupIdentity?.partnerAppId;
      
      if (!appId) {
        return res.json({ 
          success: false, 
          message: "No Gupshup app linked to this workspace",
          status: 'UNLINKED'
        });
      }

      const GupshupClientFactory = (await import('../api/gupshup-client-factory')).GupshupClientFactory;
      const client = GupshupClientFactory.getClient(appId);

      // Call Gupshup Partner API to check subscription status
      // We wrap in a try-catch to return a graceful status instead of 500
      try {
        const response = await client.get(`/partner/app/${appId}/v3/subscription/status`);
        return res.json({
          success: true,
          data: response.data
        });
      } catch (apiErr: any) {
        console.warn("[WorkspaceController:Subscription] API call failed:", apiErr.message);
        return res.json({
          success: true,
          data: {
            status: 'UNKNOWN',
            message: 'Provider API unreachable or returned error',
            error: apiErr.response?.data || apiErr.message
          }
        });
      }
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update WABA Settings
   */
  async updateWABASettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { whatsappAccessToken, whatsappPhoneNumberId, whatsappVerifyToken, wabaId, businessAccountId } = req.body;
      
      const updateData: any = {};
      if (whatsappAccessToken) updateData.whatsappAccessToken = whatsappAccessToken;
      if (whatsappPhoneNumberId) updateData.bspPhoneNumberId = whatsappPhoneNumberId;
      if (whatsappVerifyToken) updateData.whatsappVerifyToken = whatsappVerifyToken;
      if (wabaId) updateData.wabaId = wabaId;
      if (businessAccountId) updateData.businessAccountId = businessAccountId;

      const updated = await Workspace.findByIdAndUpdate(req.workspace._id, { $set: updateData }, { new: true });
      res.json({ success: true, workspace: updated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Tag Management
   */
  async listTags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { Tag } = await import('../models');
      const tags = await Tag.find({ workspace: req.workspace._id });
      res.json({ success: true, data: tags, tags });
    } catch (err) {
      next(err);
    }
  },

  async createTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { Tag } = await import('../models');
      const tag = await Tag.create({ ...req.body, workspace: req.workspace._id });
      res.json({ success: true, data: tag });
    } catch (err) {
      next(err);
    }
  },

  async deleteTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { Tag } = await import('../models');
      await Tag.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Quick Replies Management
   * Includes both Workspace-wide and Personal (User) replies
   */
  async listQuickReplies(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { QuickReply } = await import('../models');
      const replies = await QuickReply.find({ 
        workspace: req.workspace._id,
        $or: [
          { scope: 'workspace' },
          { scope: 'personal', owner: req.user._id }
        ]
      });
      res.json({ success: true, data: replies });
    } catch (err) {
      next(err);
    }
  },

  async saveQuickReply(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { QuickReply } = await import('../models');
      const { id, scope = 'workspace', ...data } = req.body;
      
      let reply;
      if (id) {
        // Security check: ensure user owns the personal reply if scope is personal
        const existing = await QuickReply.findById(id);
        if (existing?.scope === 'personal' && existing.owner?.toString() !== req.user._id.toString()) {
          throw new ForbiddenError("Cannot modify another user's personal reply");
        }

        reply = await QuickReply.findOneAndUpdate(
          { _id: id, workspace: req.workspace._id },
          { $set: { ...data, scope, owner: scope === 'personal' ? req.user._id : undefined } },
          { new: true }
        );
      } else {
        reply = await QuickReply.create({ 
          ...data, 
          workspace: req.workspace._id,
          scope,
          owner: scope === 'personal' ? req.user._id : undefined,
          createdBy: req.user._id 
        });
      }
      res.json({ success: true, data: reply });
    } catch (err) {
      next(err);
    }
  },

  async deleteQuickReply(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { QuickReply } = await import('../models');
      const existing = await QuickReply.findById(req.params.id);
      
      if (existing?.scope === 'personal' && existing.owner?.toString() !== req.user._id.toString()) {
        throw new ForbiddenError("Cannot delete another user's personal reply");
      }

      await QuickReply.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Inbox & Chat Assignment Settings
   */
  async getInboxSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ws = await Workspace.findById(req.workspace._id).select('inboxSettings').lean();
      if (!ws) throw new NotFoundError("Workspace not found");

      res.json({
        success: true,
        data: ws.inboxSettings || {
          autoAssignmentEnabled: false,
          assignmentStrategy: 'MANUAL',
          maxConcurrentChats: 10,
          slaEnabled: false,
          slaFirstResponseMinutes: 60,
          slaResolutionMinutes: 1440,
          agentRateLimitEnabled: true,
          agentMessagesPerMinute: 30,
          softLockEnabled: true,
          softLockTimeoutSeconds: 60
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async updateInboxSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        { $set: { inboxSettings: req.body } },
        { new: true, select: 'inboxSettings' }
      ).lean();
      
      res.json({ success: true, data: updated?.inboxSettings });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Teams Management
   */
  async listTeams(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const teams = await Team.find({ workspace: req.workspace._id, isActive: true }).populate('members.user', 'name email').lean();
      res.json({ success: true, data: teams });
    } catch (err) {
      next(err);
    }
  },

  async getTeamRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const team = await Team.findOne({ _id: req.params.id, workspace: req.workspace._id })
        .populate('members.user', '_id name email role status')
        .lean();
      if (!team) throw new NotFoundError("Team not found");
      res.json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  },

  async deleteTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await Team.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { $set: { isActive: false } }
      );
      res.json({ success: true, message: "Team deleted successfully" });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Roles & Permissions Matrix
   */
  async getPermissionsMatrix(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const roles = ['owner', 'admin', 'manager', 'agent', 'viewer'];
      const matrix: any = {};
      
      roles.forEach(role => {
        matrix[role] = {
          slug: role,
          permissions: (Permission as any).getDefaultPermissions(role)
        };
      });

      res.json({ success: true, data: matrix });
    } catch (err) {
      next(err);
    }
  },

  async getRoles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const systemSlugs = ['owner', 'admin', 'manager', 'agent', 'viewer'];
      const system = systemSlugs.map((slug) => ({
        _id: `system_${slug}`,
        name: slug.charAt(0).toUpperCase() + slug.slice(1),
        slug,
        isSystem: true,
        color: 'slate',
        permissions: (Permission as any).getDefaultPermissions(slug)
      }));
      const custom = await Role.find({ workspace: req.workspace._id }).lean();
      res.json({ success: true, data: [...system, ...custom] });
    } catch (err) {
      next(err);
    }
  },

  async getRoleRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = await Role.findOne({ _id: req.params.id, workspace: req.workspace._id }).lean();
      if (!role) throw new NotFoundError("Role not found");
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  async createCustomRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, slug, description, permissions, color } = req.body;
      if (!name) throw new BadRequestError('Role name is required');
      const role = await Role.create({
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '_'),
        description,
        workspace: req.workspace._id,
        permissions: permissions || (Permission as any).getDefaultPermissions('agent'),
        isSystem: false,
        color: color || 'slate'
      });
      res.status(201).json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  async updateCustomRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const role = await Role.findOne({ _id: id, workspace: req.workspace._id });
      if (!role) throw new NotFoundError('Role not found');
      if (role.isSystem) throw new ForbiddenError('Cannot modify system role');
      Object.assign(role, req.body);
      await role.save();
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  },

  async deleteCustomRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const role = await Role.findOne({ _id: id, workspace: req.workspace._id });
      if (!role) throw new NotFoundError('Role not found');
      if (role.isSystem) throw new ForbiddenError('Cannot delete system role');
      await role.deleteOne();
      res.json({ success: true, message: 'Role deleted' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Developer Settings & API Keys
   */
  async getDeveloperSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).select('webhookSubscriptions apiKeys').lean();
      res.json({ 
        success: true, 
        data: {
          webhooks: workspace?.webhookSubscriptions || [],
          apiKeysCount: workspace?.apiKeys?.length || 0
        } 
      });
    } catch (err) {
      next(err);
    }
  },

  async updateDeveloperSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        { $set: req.body },
        { new: true }
      );
      res.json({ success: true, workspace: updated });
    } catch (err) {
      next(err);
    }
  },

  async getApiKeys(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).select('apiKeys').lean();
      const keys = (workspace?.apiKeys || []).map((k: any) => ({
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

  async createApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const key = `wapi_${crypto.randomBytes(24).toString('hex')}`;
      
      const workspace = await Workspace.findByIdAndUpdate(
        req.workspace._id,
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

      res.status(201).json({ 
        success: true, 
        data: {
          name,
          key, // Return full key once on creation
          isActive: true
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async revokeApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await Workspace.findByIdAndUpdate(
        req.workspace._id,
        {
          $pull: {
            apiKeys: { _id: id }
          }
        }
      );
      res.json({ success: true, message: "API key revoked" });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get WABA Profile (Frontend expects /workspace/profile)
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).lean();
      if (!workspace) throw new NotFoundError("Workspace not found");

      const bp = workspace.businessProfile || {};
      const statusFromPhone = String(workspace.bspPhoneStatus || '').toUpperCase();
      const connected = workspace.whatsappConnected || statusFromPhone === 'CONNECTED';

      res.json({
        success: true,
        data: {
          displayName: bp.displayName || workspace.bspVerifiedName || workspace.name || "",
          description: bp.description || workspace.description || "",
          address: bp.address || workspace.address || "",
          email: bp.email || "",
          vertical: bp.vertical || workspace.industry || "PROFESSIONAL_SERVICES",
          websites: bp.websites || (workspace.website ? [workspace.website] : []),
          profilePicUrl: bp.profilePicUrl || null,
          status: connected ? 'CONNECTED' : (statusFromPhone || 'DISCONNECTED'),
          quality: String(workspace.bspQualityRating || 'UNKNOWN').toUpperCase(),
          limit: workspace.bspMessagingTier || "UNKNOWN",
          lastSyncedAt: workspace.bspLastSyncedAt || null
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { displayName, description, address, email, vertical, websites } = req.body;
      const updated = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        {
          $set: {
            'businessProfile.displayName': displayName,
            'businessProfile.description': description,
            'businessProfile.address': address,
            'businessProfile.email': email,
            'businessProfile.vertical': vertical,
            'businessProfile.websites': websites,
            description: description || req.workspace.description,
            address: address || req.workspace.address,
            industry: vertical || req.workspace.industry,
            website: websites?.[0] || req.workspace.website
          }
        },
        { new: true }
      );

      // Push to Gupshup if app assigned
      if (updated?.gupshupAppId) {
        const { GupshupPartnerService } = await import('../services/bsp/gupshup-partner-service');
        await GupshupPartnerService.updateBusinessProfile(updated.gupshupAppId, {
          description,
          address,
          email,
          vertical,
          websites
        }).catch(e => console.error("[WABA Profile Update] Push failed:", e.message));
      }

      res.json({ success: true, data: updated?.businessProfile });
      await logActivity(req, 'update', 'settings', {
        entityName: 'Business Profile',
        status: 'success'
      }).catch(() => null);
    } catch (err) {
      next(err);
    }
  },

  async syncProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id);
      if (!workspace?.gupshupAppId) throw new Error("No Gupshup app assigned");

      const { GupshupPartnerService } = await import('../services/bsp/gupshup-partner-service');
      const remote = await GupshupPartnerService.getBusinessProfile(workspace.gupshupAppId);
      
      const updated = await Workspace.findByIdAndUpdate(
        workspace._id,
        { $set: { businessProfile: remote, bspLastSyncedAt: new Date() } },
        { new: true }
      );

      res.json({ success: true, data: updated?.businessProfile });
    } catch (err) {
      next(err);
    }
  },

  async updateDisplayName(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const name = req.body.name || req.body.displayName;
      const workspace = await Workspace.findById(req.workspace._id);
      if (!workspace?.gupshupAppId) throw new Error("No Gupshup app assigned");

      const { GupshupPartnerService } = await import('../services/bsp/gupshup-partner-service');
      await GupshupPartnerService.updateProfileDisplayName(workspace.gupshupAppId, name);

      await Workspace.findByIdAndUpdate(workspace._id, { $set: { 'businessProfile.displayName': name } });
      res.json({ success: true, message: "Display name update initiated" });
    } catch (err) {
      next(err);
    }
  },

  async getWhatsappHealth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id).lean();
      res.json({
        success: true,
        data: {
          qualityRating: workspace?.bspQualityRating || "UNKNOWN",
          messagingLimit: workspace?.bspMessagingTier || "UNKNOWN",
          phoneStatus: workspace?.bspPhoneStatus || (workspace?.whatsappConnected ? "CONNECTED" : "DISCONNECTED"),
          webhookPulse: "OPERATIONAL",
          lastChecked: new Date()
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Billing Summary
   */
  async getBillingSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { workspace, user } = req;
      
      const [txRes, walletRes, fullWs] = await Promise.all([
        proxyController.forwardToService('billing', {
          method: 'GET',
          path: `/api/billing/wallets/${workspace._id}/transactions`,
          params: { limit: 20 },
          workspaceId: workspace._id.toString(),
          userId: user._id.toString(),
          userRole: req.role || req.user?.role,
        }),
        proxyController.forwardToService('billing', {
          method: 'GET',
          path: `/api/billing/wallets/${workspace._id}`,
          workspaceId: workspace._id.toString(),
          userId: user._id.toString(),
          userRole: req.role || req.user?.role,
        }),
        Workspace.findById(workspace._id).populate('plan').lean()
      ]);

      res.json({
        wallet: {
          balance: (walletRes.data.wallet?.availableBalance ?? 0) / 100,
          currency: walletRes.data.wallet?.currency ?? 'INR',
          status: fullWs?.billingStatus || 'active',
        },
        subscription: {
          billingPivotDate: fullWs?.billingPivotDate,
          autoPay: (fullWs as any)?.autoPay ?? true,
          taxId: (fullWs as any)?.taxId || '',
        },
        plan: {
          name: (fullWs?.plan as any)?.name || fullWs?.planId || 'Free',
          slug: (fullWs?.plan as any)?.slug || 'free',
          limits: (fullWs?.plan as any)?.limits || fullWs?.planLimits || {},
        },
        transactions: (txRes.data.transactions || []).map((tx: any) => ({
          ...tx,
          amount: (tx.amount || 0) / 100
        }))
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get Available Plans
   */
  async getPlans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { Plan } = await import('../models');
      const plans = await Plan.find({ isActive: true }).sort({ monthlyBaseFeeCents: 1 });
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Switch Plan (or Initiate Purchase)
   */
  async switchPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { planId, planSlug } = req.body;
      console.log(`[switchPlan] Received request - planId: ${planId}, planSlug: ${planSlug}, workspaceId: ${req.workspace._id}`);
      
      // Fetch the full plan details from main server database
      const { Plan } = await import('../models');
      const plan = planId 
        ? await Plan.findById(planId)
        : await Plan.findOne({ slug: planSlug });
      
      if (!plan) {
        return res.status(404).json({ success: false, message: 'Plan not found' });
      }

      console.log(`[switchPlan] Found plan: ${(plan as any).slug}, monthlyBaseFeeCents: ${(plan as any).monthlyBaseFeeCents}`);
      
      // Proxy to billing service with full plan details
      const response = await proxyController.forwardToService('billing', {
        method: 'POST',
        path: `/api/billing/wallets/${req.workspace._id}/plan`,
        data: {
          planId: plan._id.toString(),
          planSlug: (plan as any).slug,
          planName: (plan as any).name,
          monthlyBaseFeeCents: (plan as any).monthlyBaseFeeCents,
          yearlyBaseFeeCents: (plan as any).yearlyBaseFeeCents,
          currency: (plan as any).currency || 'INR'
        },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString()
      });

      console.log(`[switchPlan] Billing service response - status: ${response.status}, data: ${JSON.stringify(response.data)}`);

      // If billing service says activation was successful (Scenario 2: Free Plan)
      if (response.data.success && !response.data.requiresPayment) {
        await Workspace.findByIdAndUpdate(req.workspace._id, {
          $set: {
            plan: plan._id,
            planId: (plan as any).slug,
            planLimits: (plan as any).limits,
            billingStatus: 'active'
          }
        });
      }

      res.status(response.status).json(response.data);
    } catch (err) {
      console.error(`[switchPlan] Error: ${err}`);
      next(err);
    }
  },

  /**
   * Update Billing Settings
   */
  async updateBillingSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { autoPay, taxId } = req.body;
      const updateData: any = {};
      if (autoPay !== undefined) updateData.autoPay = autoPay;
      if (taxId !== undefined) updateData.taxId = taxId;

      const updated = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        { $set: updateData },
        { new: true }
      );
      res.json({ success: true, workspace: updated });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Initiate Wallet Recharge
   */
  async initiateRecharge(req: AuthRequest, res: Response, next: NextFunction) {
    return proxyController.proxyTo('billing', req, res, next);
  },

  /**
   * Verify Wallet Recharge
   */
  async verifyRecharge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const response = await proxyController.forwardToService('billing', {
        method: 'POST',
        path: `/api/billing/wallets/recharge/verify`,
        data: { 
          ...req.body, 
          workspaceId: req.workspace._id.toString(),
          workspaceDetails: {
            workspaceName: req.workspace.name,
            ownerName: req.user.name,
            ownerEmail: req.user.email,
            country: req.workspace.country,
            walletCurrency: req.workspace.walletCurrency || 'INR'
          }
        },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString()
      });

      res.json({
        success: true,
        message: 'Wallet credited successfully',
        ...response.data
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Initiate Payment Method Verification
   */
  async initiatePaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    return proxyController.proxyTo('billing', req, res, next);
  },

  /**
   * Verify Payment Method
   */
  async verifyPaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
    return proxyController.proxyTo('billing', req, res, next);
  },

  /**
   * Verify Plan Upgrade
   */
  async verifyPlanUpgrade(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const response = await proxyController.forwardToService('billing', {
        method: 'POST',
        path: `/api/billing/wallets/plan/verify`,
        data: { 
          ...req.body, 
          workspaceId: req.workspace._id.toString(),
          workspaceDetails: {
            workspaceName: req.workspace.name,
            ownerName: req.user.name,
            ownerEmail: req.user.email
          }
        },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString()
      });

      // If successful, update the main server's workspace record too
      if (response.data.success) {
        const { planSlug } = response.data;
        const { Plan } = await import('../models');
        const targetPlan = await Plan.findOne({ slug: planSlug });
        if (targetPlan) {
          await Workspace.findByIdAndUpdate(req.workspace._id, {
            $set: {
              plan: targetPlan._id,
              planId: targetPlan.slug,
              planLimits: targetPlan.limits,
              billingStatus: 'active'
            }
          });
        }
      }

      res.json(response.data);
    } catch (err) {
      next(err);
    }
  },

  async searchTeamMemberByEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const email = String(req.query.email || '').trim().toLowerCase();
      if (!email || email.length < 3) {
        return res.json({ success: true, data: null });
      }
      const user = await User.findOne({ email }).select('name email phone role status').lean();
      if (!user) {
        return res.json({ success: true, data: { exists: false } });
      }
      const membership = await Permission.findOne({
        workspace: req.workspace._id,
        user: user._id
      })
        .select('role isActive')
        .lean();

      res.json({
        success: true,
        data: {
          exists: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone
          },
          isMember: !!membership && membership.isActive !== false,
          membershipStatus: membership ? (membership.isActive !== false ? 'active' : 'removed') : 'none',
          membershipRole: membership?.role
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async inviteMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, name, role, phone, teamIds = [] } = req.body;
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || !role) throw new BadRequestError('Email and role are required');

      const appBase = config.baseUrl.replace(/\/$/, '');
      const { MailService } = await import('../services/shared/mail-service');
      const wsName = (req.workspace as any)?.name || 'Workspace';

      const existingInvite = await WorkspaceInvitation.findOne({
        email: normalizedEmail,
        workspace: req.workspace._id,
        status: 'pending'
      });

      if (existingInvite) {
        const invitationToken = crypto.randomBytes(32).toString('hex');
        existingInvite.token = invitationToken;
        existingInvite.expiresAt = new Date(Date.now() + 7 * 864e5);
        existingInvite.resendCount = (existingInvite.resendCount || 0) + 1;
        existingInvite.lastSentAt = new Date();
        await existingInvite.save();
        const invitationUrl = `${appBase}/auth/accept-invite?token=${invitationToken}&email=${encodeURIComponent(normalizedEmail)}`;
        await MailService.sendInvitation({
          to: normalizedEmail,
          inviterName: req.user.name,
          workspaceName: wsName,
          role: existingInvite.role,
          invitationUrl
        });
        return res.json({
          success: true,
          message: 'Existing invitation updated and email resent.',
          data: { id: existingInvite._id, email: existingInvite.email }
        });
      }

      const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
      if (existingUser) {
        const memberPerm = await Permission.findOne({
          workspace: req.workspace._id,
          user: existingUser._id,
          isActive: { $ne: false }
        });
        if (memberPerm) {
          return res.status(409).json({
            success: false,
            error: 'User is already a member of this workspace',
            isMember: true
          });
        }
      }

      const invitationToken = crypto.randomBytes(32).toString('hex');
      const invitation = await WorkspaceInvitation.create({
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        workspace: req.workspace._id,
        role,
        invitedBy: req.user._id,
        token: invitationToken,
        teams: teamIds,
        phone: phone || undefined,
        expiresAt: new Date(Date.now() + 7 * 864e5),
        status: 'pending'
      });

      const invitationUrl = `${appBase}/auth/accept-invite?token=${invitationToken}&email=${encodeURIComponent(normalizedEmail)}`;
      let emailStatus: any = { success: false };
      try {
        emailStatus = await MailService.sendInvitation({
          to: normalizedEmail,
          inviterName: req.user.name,
          workspaceName: wsName,
          role,
          invitationUrl
        });
      } catch (e: any) {
        emailStatus = { success: false, error: e.message };
      }

      res.status(201).json({
        success: true,
        data: {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          invitationUrl,
          emailStatus
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getMemberPermissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const perm = await Permission.findOne({
        user: req.params.memberId,
        workspace: req.workspace._id
      }).lean();
      if (!perm) throw new NotFoundError('Permission record not found');
      res.json({ success: true, data: perm });
    } catch (err) {
      next(err);
    }
  },

  async updateMemberPermissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const perm = await Permission.findOne({
        user: req.params.memberId,
        workspace: req.workspace._id
      });
      if (!perm) throw new NotFoundError('Permission record not found');
      const { permissions, role, isAvailable, maxConcurrentChats, assignedTags } = req.body;
      if (role) {
        perm.role = role;
        perm.permissions = (Permission as any).getDefaultPermissions(role);
      }
      if (permissions && typeof permissions === 'object') {
        perm.permissions = { ...(perm.permissions as any) || {}, ...permissions };
      }
      if (isAvailable !== undefined) (perm as any).isAvailable = isAvailable;
      if (maxConcurrentChats !== undefined) (perm as any).maxConcurrentChats = maxConcurrentChats;
      if (assignedTags !== undefined) (perm as any).assignedTags = assignedTags;
      await perm.save();
      res.json({ success: true, data: perm });
    } catch (err) {
      next(err);
    }
  },

  async updateMemberRoleQuick(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { role } = req.body;
      if (!role) throw new BadRequestError('Role is required');
      const perm = await Permission.findOne({
        workspace: req.workspace._id,
        user: req.params.memberId
      });
      if (!perm) throw new NotFoundError('Member not found');
      perm.role = role;
      perm.permissions = (Permission as any).getDefaultPermissions(role);
      await perm.save();
      res.json({ success: true, data: perm });
    } catch (err) {
      next(err);
    }
  },

  async updateMemberRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const workspaceId = req.workspace._id;
      const { name, phone, role, isActive, teamIds } = req.body;
      const appBase = config.baseUrl.replace(/\/$/, '');
      const { MailService } = await import('../services/shared/mail-service');
      const wsName = (req.workspace as any)?.name || 'Workspace';

      const inv = await WorkspaceInvitation.findOne({ _id: memberId, workspace: workspaceId });
      if (inv) {
        if (role) inv.role = role;
        if (name !== undefined) inv.name = name;
        if (phone !== undefined) inv.phone = phone;
        if (Array.isArray(teamIds)) inv.teams = teamIds;
        
        const invitationToken = crypto.randomBytes(32).toString('hex');
        inv.token = invitationToken;
        inv.expiresAt = new Date(Date.now() + 7 * 864e5);
        inv.resendCount = (inv.resendCount || 0) + 1;
        inv.lastSentAt = new Date();
        await inv.save();

        const invitationUrl = `${appBase}/auth/accept-invite?token=${invitationToken}&email=${encodeURIComponent(inv.email)}`;
        await MailService.sendInvitation({
          to: inv.email,
          inviterName: req.user.name,
          workspaceName: wsName,
          role: inv.role,
          invitationUrl
        });
        
        return res.json({ success: true, data: inv, message: 'Invitation updated and resent' });
      }

      const member = await User.findById(memberId);
      if (!member) throw new NotFoundError('User not found');
      
      if (name !== undefined) member.name = name;
      if (phone !== undefined) member.phone = phone;
      await member.save();

      if (role !== undefined || typeof isActive === 'boolean') {
        const update: any = {};
        if (role) {
          update.role = role;
          update.permissions = (Permission as any).getDefaultPermissions(role);
        }
        if (typeof isActive === 'boolean') update.isActive = isActive;
        await Permission.findOneAndUpdate({ user: memberId, workspace: workspaceId }, update);
      }

      // Handle team membership updates
      if (Array.isArray(teamIds)) {
        const { Team } = await import('../models');
        const mId = new Types.ObjectId(memberId);
        // Pull from all teams in this workspace
        await Team.updateMany(
          { workspace: workspaceId },
          { $pull: { members: { user: mId } } }
        );
        // Push to new ones
        if (teamIds.length > 0) {
          await Team.updateMany(
            { _id: { $in: teamIds.map(id => new Types.ObjectId(id)) }, workspace: workspaceId },
            { $addToSet: { members: { user: mId, role: 'member', addedAt: new Date() } } }
          );
        }
      }

      res.json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  },

  async resendInvitation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { invitationId } = req.params;
      const workspaceId = req.workspace._id;
      const appBase = config.baseUrl.replace(/\/$/, '');
      const { MailService } = await import('../services/shared/mail-service');
      const wsName = (req.workspace as any)?.name || 'Workspace';

      const invitation = await WorkspaceInvitation.findOne({
        _id: invitationId,
        workspace: workspaceId,
        status: 'pending'
      });
      if (!invitation) throw new NotFoundError('Pending invitation not found');

      const invitationToken = crypto.randomBytes(32).toString('hex');
      invitation.token = invitationToken;
      invitation.expiresAt = new Date(Date.now() + 7 * 864e5);
      invitation.resendCount = (invitation.resendCount || 0) + 1;
      invitation.lastSentAt = new Date();
      await invitation.save();

      const invitationUrl = `${appBase}/auth/accept-invite?token=${invitationToken}&email=${encodeURIComponent(invitation.email)}`;
      await MailService.sendInvitation({
        to: invitation.email,
        inviterName: req.user.name,
        workspaceName: wsName,
        role: invitation.role,
        invitationUrl
      });

      res.json({
        success: true,
        message: 'Invitation resent successfully',
        data: { id: invitation._id, email: invitation.email }
      });
    } catch (err) {
      next(err);
    }
  },

  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const workspaceId = req.workspace._id;

      const inv = await WorkspaceInvitation.findOne({ _id: memberId, workspace: workspaceId });
      if (inv) {
        await inv.deleteOne();
        return res.json({ success: true, message: 'Invitation removed' });
      }

      const perm = await Permission.findOne({ workspace: workspaceId, user: memberId });
      if (!perm) throw new NotFoundError('Member not found');

      // 1. Deactivate permission
      perm.isActive = false;
      (perm as any).isOnline = false;
      (perm as any).isAvailable = false;
      await perm.save();

      // 2. Clean up Team memberships
      const { Team, Conversation, User } = await import('../models');
      const mId = new Types.ObjectId(memberId);
      await Team.updateMany(
        { workspace: workspaceId },
        { $pull: { members: { user: mId } } }
      );

      // 3. Unassign open/pending conversations
      await Conversation.updateMany(
        { 
          workspace: workspaceId, 
          assignedTo: mId, 
          status: { $in: ['open', 'pending'] } 
        },
        { $unset: { assignedTo: '' } }
      );

      // 4. If user's active workspace is this one, switch to another active workspace
      const user = await User.findById(memberId);
      if (user && user.activeWorkspace?.toString() === workspaceId.toString()) {
        const otherPerm = await Permission.findOne({ 
          user: user._id, 
          isActive: true 
        }).sort({ createdAt: -1 });
        
        if (otherPerm) {
          user.activeWorkspace = otherPerm.workspace;
        } else {
          user.activeWorkspace = undefined;
        }
        await user.save();
      }

      res.json({ success: true, message: 'Member removed and data cleaned up' });
    } catch (err) {
      next(err);
    }
  },

  async createTeamRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, members = [], visibility, autoAssign } = req.body;
      const workspaceId = req.workspace._id;

      if (!name) throw new BadRequestError('Team name is required');

      // 1. Duplicate Check
      const existing = await Team.findOne({ 
        workspace: workspaceId, 
        name: name.trim(), 
        isActive: true 
      });
      if (existing) throw new BadRequestError('A team with this name already exists');

      // 2. Validate Members (ensure they belong to workspace)
      const memberIds = members.map((m: any) => m.userId || m.user || m);
      if (memberIds.length > 0) {
        const validMembers = await Permission.countDocuments({
          workspace: workspaceId,
          user: { $in: memberIds },
          isActive: { $ne: false }
        });
        if (validMembers !== memberIds.length) {
          throw new BadRequestError('Some members do not belong to this workspace');
        }
      }

      const memberDocs = (members as any[]).map((m) => ({
        user: m.userId || m.user || m,
        role: m.role === 'lead' ? 'lead' : 'member',
        addedAt: new Date()
      }));

      const team = await Team.create({
        name: name.trim(),
        description: description?.trim(),
        workspace: workspaceId,
        members: memberDocs,
        visibility: visibility || 'team_only',
        autoAssign: autoAssign || { enabled: false, strategy: 'round_robin' },
        createdBy: req.user._id,
        isActive: true
      });

      res.status(201).json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  },

  async updateTeamRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace._id;
      const team = await Team.findOne({ _id: req.params.id, workspace: workspaceId });
      if (!team) throw new NotFoundError('Team not found');

      const { name, description, members, visibility, autoAssign } = req.body;
      
      if (name !== undefined) {
        const trimmedName = name.trim();
        const existing = await Team.findOne({ 
          workspace: workspaceId, 
          name: trimmedName, 
          _id: { $ne: team._id },
          isActive: true 
        });
        if (existing) throw new BadRequestError('A team with this name already exists');
        team.name = trimmedName;
      }

      if (description !== undefined) team.description = description.trim();
      if (visibility !== undefined) team.visibility = visibility;
      if (autoAssign !== undefined) team.autoAssign = { ...team.autoAssign, ...autoAssign };

      if (Array.isArray(members)) {
        // Validate members
        const memberIds = members.map((m: any) => m.userId || m.user || m);
        if (memberIds.length > 0) {
          const validMembers = await Permission.countDocuments({
            workspace: workspaceId,
            user: { $in: memberIds },
            isActive: { $ne: false }
          });
          if (validMembers !== memberIds.length) {
            throw new BadRequestError('Some members do not belong to this workspace');
          }
        }

        team.members = members.map((m: any) => ({
          user: m.userId || m.user || m,
          role: m.role === 'lead' ? 'lead' : 'member',
          addedAt: m.addedAt || new Date()
        }));
      }

      await team.save();
      res.json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  },

  async listWebhooks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ws = await Workspace.findById(req.workspace._id).select('webhookSubscriptions').lean();
      res.json({ success: true, data: ws?.webhookSubscriptions || [] });
    } catch (err) {
      next(err);
    }
  },

  async createWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { url, events = [], secret, isActive = true } = req.body;
      if (!url) throw new BadRequestError('Webhook URL is required');
      const sub: any = { url, events, secret, isActive, createdAt: new Date() };
      const updated = await Workspace.findByIdAndUpdate(
        req.workspace._id,
        { $push: { webhookSubscriptions: sub } },
        { new: true }
      ).select('webhookSubscriptions');
      const list = updated?.webhookSubscriptions || [];
      res.status(201).json({ success: true, data: list[list.length - 1] });
    } catch (err) {
      next(err);
    }
  },

  async updateWebhookRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ws = await Workspace.findById(req.workspace._id);
      if (!ws) throw new NotFoundError('Workspace not found');
      const sub = (ws.webhookSubscriptions as any).id(req.params.id);
      if (!sub) throw new NotFoundError('Webhook not found');
      const { url, events, secret, isActive } = req.body;
      if (url !== undefined) sub.url = url;
      if (events !== undefined) sub.events = events;
      if (secret !== undefined) sub.secret = secret;
      if (isActive !== undefined) sub.isActive = isActive;
      await ws.save();
      res.json({ success: true, data: sub });
    } catch (err) {
      next(err);
    }
  },

  async deleteWebhookRecord(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await Workspace.findByIdAndUpdate(req.workspace._id, {
        $pull: { webhookSubscriptions: { _id: req.params.id } }
      });
      res.json({ success: true, message: 'Webhook removed' });
    } catch (err) {
      next(err);
    }
  },

  async testWabaConnection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await Workspace.findById(req.workspace._id);
      if (!workspace?.gupshupAppId) throw new BadRequestError('No Gupshup app linked to this workspace');
      const { GupshupPartnerService } = await import('../services/bsp/gupshup-partner-service');
      await GupshupPartnerService.getPartnerApp(workspace.gupshupAppId);
      res.json({ success: true, message: 'WhatsApp Cloud API reachable' });
    } catch (err) {
      next(err);
    }
  }
};
