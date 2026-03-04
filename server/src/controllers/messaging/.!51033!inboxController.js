/**
 * Inbox Controller - Stage 4 + Hardening
 * Handles Shared Inbox operations: Assignment, Status Changes, Agent Messaging
 * 
 * Following Interakt's architecture for:
 * - Conversation assignment (assign/unassign/reassign)
 * - Status management (close/reopen/snooze)
 * - Agent messaging with permission validation
 * 
 * Stage 4 Hardening additions:
 * - Soft lock / typing indicators
 * - SLA monitoring endpoints
 * - Rate limit status
 */

const { Conversation, Message, Contact, User, Permission } = require('../../models');
const { getIO } = require('../../utils/socket');

// Hardening services
const softLockService = require('../../services/infrastructure/softLockService');
const slaService = require('../../services/infrastructure/slaService');
const agentRateLimitService = require('../../services/infrastructure/agentRateLimitService');

async function ensurePermissions(req) {
  if (req.permissions) return req.permissions;

  const userId = req.user?._id;
  const workspaceId = req.user?.workspace;

  if (!userId || !workspaceId) return null;

  let permission = await Permission.findOne({
    workspace: workspaceId,
    user: userId
  }).lean();

  if (!permission) {
    const user = await User.findById(userId).select('role').lean();
    const role = user?.role || 'viewer';
    const defaultPermissions = Permission.getDefaultPermissions(role);

    permission = {
      role,
      permissions: defaultPermissions,
      isActive: true
    };

    Permission.create({
      workspace: workspaceId,
      user: userId,
      role,
      permissions: defaultPermissions,
      isActive: true
    }).catch(err => console.error('[INBOX] Failed to seed permissions:', err.message));
  }

  req.permissions = permission;
  return permission;
}

