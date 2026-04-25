/**
 * WORKSPACE SERVICE
 * Workspace management and configuration
 */

const { Workspace, User } = require('../../models');
const baseRepository = require('../../repositories/baseRepository');
const logger = require('../../utils/logger');
const { createError } = require('../../utils/errorFormatter');

class WorkspaceService extends baseRepository {
  constructor() {
    super(Workspace);
  }

  /**
   * Create new workspace
   */
  async createWorkspace(ownerId, workspaceData) {
    try {
      const workspace = new Workspace({
        ...workspaceData,
        owner: ownerId,
        members: [{
          user: ownerId,
          role: 'owner',
          joinedAt: new Date()
        }],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await workspace.save();

      // Update user's workspaces
      await User.findByIdAndUpdate(ownerId, {
        $push: { workspaces: workspace._id }
      });

      logger.info('Workspace created', { workspaceId: workspace._id, ownerId });
      return workspace;
    } catch (error) {
      logger.error('Failed to create workspace', { ownerId, error: error.message });
      throw createError('WORKSPACE_CREATION_FAILED', 'Failed to create workspace', 500);
    }
  }

  /**
   * Get workspace by ID with populated data
   */
  async getWorkspaceById(workspaceId) {
    try {
      const workspace = await Workspace.findById(workspaceId)
        .populate('owner', 'name email')
        .populate('members.user', 'name email avatar')
        .populate('plan', 'name features limits');

      if (!workspace) {
        throw createError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
      }

      return workspace;
    } catch (error) {
      logger.error('Failed to get workspace', { workspaceId, error: error.message });
      throw error;
    }
  }

  /**
   * Update workspace
   */
  async updateWorkspace(workspaceId, updateData, userId) {
    try {
      // Check if user has permission to update
      const workspace = await this.getWorkspaceById(workspaceId);
      const member = workspace.members.find(m => m.user._id.toString() === userId);

      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to update workspace', 403);
      }

      const updatedWorkspace = await Workspace.findByIdAndUpdate(
        workspaceId,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).populate('owner', 'name email')
       .populate('members.user', 'name email avatar')
       .populate('plan', 'name features limits');

      logger.info('Workspace updated', { workspaceId, userId });
      return updatedWorkspace;
    } catch (error) {
      logger.error('Failed to update workspace', { workspaceId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Add member to workspace
   */
  async addMember(workspaceId, userId, role = 'member', addedBy) {
    try {
      const workspace = await this.getWorkspaceById(workspaceId);

      // Check if adder has permission
      const adder = workspace.members.find(m => m.user._id.toString() === addedBy);
      if (!adder || !['owner', 'admin'].includes(adder.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to add members', 403);
      }

      // Check if user is already a member
      const existingMember = workspace.members.find(m => m.user._id.toString() === userId);
      if (existingMember) {
        throw createError('USER_ALREADY_MEMBER', 'User is already a member of this workspace', 400);
      }

      // Add member
      workspace.members.push({
        user: userId,
        role,
        joinedAt: new Date(),
        addedBy
      });

      await workspace.save();

      // Update user's workspaces
      await User.findByIdAndUpdate(userId, {
        $push: { workspaces: workspace._id }
      });

      logger.info('Member added to workspace', { workspaceId, userId, role, addedBy });
      return workspace;
    } catch (error) {
      logger.error('Failed to add member to workspace', {
        workspaceId,
        userId,
        addedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId, userId, removedBy) {
    try {
      const workspace = await this.getWorkspaceById(workspaceId);

      // Check if remover has permission
      const remover = workspace.members.find(m => m.user._id.toString() === removedBy);
      if (!remover || !['owner', 'admin'].includes(remover.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to remove members', 403);
      }

      // Cannot remove owner
      const memberToRemove = workspace.members.find(m => m.user._id.toString() === userId);
      if (!memberToRemove) {
        throw createError('MEMBER_NOT_FOUND', 'Member not found in workspace', 404);
      }

      if (memberToRemove.role === 'owner') {
        throw createError('CANNOT_REMOVE_OWNER', 'Cannot remove workspace owner', 400);
      }

      // Remove member
      workspace.members = workspace.members.filter(m => m.user._id.toString() !== userId);
      await workspace.save();

      // Update user's workspaces
      await User.findByIdAndUpdate(userId, {
        $pull: { workspaces: workspace._id }
      });

      logger.info('Member removed from workspace', { workspaceId, userId, removedBy });
      return workspace;
    } catch (error) {
      logger.error('Failed to remove member from workspace', {
        workspaceId,
        userId,
        removedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(workspaceId, userId, newRole, updatedBy) {
    try {
      const workspace = await Workspace.findById(workspaceId);

      // Check if updater has permission
      const updater = workspace.members.find(m => m.user._id.toString() === updatedBy);
      if (!updater || !['owner', 'admin'].includes(updater.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to update member roles', 403);
      }

      // Cannot change owner's role
      const member = workspace.members.find(m => m.user._id.toString() === userId);
      if (!member) {
        throw createError('MEMBER_NOT_FOUND', 'Member not found in workspace', 404);
      }

      if (member.role === 'owner') {
        throw createError('CANNOT_CHANGE_OWNER_ROLE', 'Cannot change workspace owner role', 400);
      }

      // Update role
      member.role = newRole;
      await workspace.save();

      logger.info('Member role updated', { workspaceId, userId, newRole, updatedBy });
      return workspace;
    } catch (error) {
      logger.error('Failed to update member role', {
        workspaceId,
        userId,
        newRole,
        updatedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get workspaces for user
   */
  async getUserWorkspaces(userId) {
    try {
      const workspaces = await Workspace.find({
        'members.user': userId,
        isActive: true
      })
      .populate('owner', 'name email')
      .populate('members.user', 'name email avatar')
      .populate('plan', 'name features limits')
      .sort({ updatedAt: -1 });

      return workspaces;
    } catch (error) {
      logger.error('Failed to get user workspaces', { userId, error: error.message });
      throw createError('WORKSPACES_FETCH_FAILED', 'Failed to fetch user workspaces', 500);
    }
  }

  /**
   * Configure BSP for workspace
   */
  async configureBsp(workspaceId, bspConfig, userId) {
    try {
      const workspace = await this.getWorkspaceById(workspaceId);

      // Check permissions
      const member = workspace.members.find(m => m.user._id.toString() === userId);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to configure BSP', 403);
      }

      workspace.bspConfig = { ...workspace.bspConfig, ...bspConfig };
      workspace.bspProvider = bspConfig.provider || workspace.bspProvider;
      workspace.updatedAt = new Date();

      await workspace.save();

      logger.info('BSP configured for workspace', { workspaceId, provider: bspConfig.provider, userId });
      return workspace;
    } catch (error) {
      logger.error('Failed to configure BSP', { workspaceId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update workspace settings
   */
  async updateSettings(workspaceId, settings, userId) {
    try {
      const workspace = await this.getWorkspaceById(workspaceId);

      // Check permissions
      const member = workspace.members.find(m => m.user._id.toString() === userId);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions to update settings', 403);
      }

      workspace.settings = { ...workspace.settings, ...settings };
      workspace.updatedAt = new Date();

      await workspace.save();

      logger.info('Workspace settings updated', { workspaceId, userId });
      return workspace;
    } catch (error) {
      logger.error('Failed to update workspace settings', { workspaceId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Deactivate workspace
   */
  async deactivateWorkspace(workspaceId, userId) {
    try {
      const workspace = await this.getWorkspaceById(workspaceId);

      // Only owner can deactivate
      if (workspace.owner._id.toString() !== userId) {
        throw createError('INSUFFICIENT_PERMISSIONS', 'Only workspace owner can deactivate workspace', 403);
      }

      workspace.isActive = false;
      workspace.deactivatedAt = new Date();
      workspace.updatedAt = new Date();

      await workspace.save();

      logger.info('Workspace deactivated', { workspaceId, userId });
      return workspace;
    } catch (error) {
      logger.error('Failed to deactivate workspace', { workspaceId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get workspace usage statistics
   */
  async getWorkspaceUsage(workspaceId) {
    try {
      const workspace = await this.getWorkspaceById(workspaceId);

      // This would aggregate usage data from various sources
      // For now, return basic structure
      const usage = {
        messages: {
          sent: 0, // Would aggregate from message logs
          delivered: 0,
          read: 0
        },
        contacts: 0, // Would count contacts
        templates: 0, // Would count templates
        campaigns: 0, // Would count campaigns
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date()
        }
      };

      return usage;
    } catch (error) {
      logger.error('Failed to get workspace usage', { workspaceId, error: error.message });
      throw createError('USAGE_FETCH_FAILED', 'Failed to fetch workspace usage', 500);
    }
  }
}

module.exports = new WorkspaceService();