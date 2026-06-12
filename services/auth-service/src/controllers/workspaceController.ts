import express from 'express';
import { Workspace, Permission, ActivityLog } from '../models/index.js';
import { AuthRequest } from '../middleware/businessAuth.js';
import { extractToken, resolveUserFromToken } from '../utils/authHelper.js';

// Fire-and-forget workspace audit trail (monolith logActivity parity).
async function logWorkspaceActivity(req: AuthRequest, action: string, entityType: string, metadata?: any) {
  try {
    if (!req.user?._id || !req.workspace?._id) return;
    await ActivityLog.create({
      workspace: req.workspace._id,
      user: req.user._id,
      action,
      entityType,
      entityId: req.workspace._id,
      status: 'success',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      timestamp: new Date(),
      metadata,
    });
  } catch (err: any) {
    console.error('[ActivityLog] Error logging activity:', err.message);
  }
}

export const getWorkspaces = async (req: express.Request, res: express.Response) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const user = await resolveUserFromToken(token);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const memberships = await Permission.find({ user: user._id, isActive: { $ne: false } }).populate('workspace');
    const workspaces = memberships.map((m: any) => ({
      id: m.workspace._id,
      name: m.workspace.name,
      isActive: user.activeWorkspace?.toString() === m.workspace._id.toString(),
      role: m.role,
    }));

    return res.status(200).json({ success: true, workspaces });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch workspaces' });
  }
};

export const switchWorkspace = async (req: express.Request, res: express.Response) => {
  try {
    const { workspaceId } = req.body || {};
    if (!workspaceId) return res.status(400).json({ success: false, message: 'workspaceId is required' });

    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const user = await resolveUserFromToken(token);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const permission = await Permission.findOne({ user: user._id, workspace: workspaceId, isActive: { $ne: false } });
    if (!permission) return res.status(403).json({ success: false, message: 'Not a member of the requested workspace' });

    user.activeWorkspace = workspaceId;
    await user.save();
    return res.status(200).json({ success: true, message: 'Switched workspace' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to switch workspace' });
  }
};

export const getPendingInvitations = async (req: express.Request, res: express.Response) => {
  try {
    // Return empty list for now matching old code fallback
    return res.status(200).json({ success: true, invitations: [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch invitations' });
  }
};

export const getWorkspaceSettings = async (req: AuthRequest, res: express.Response) => {
  try {
    const ws = await Workspace.findById(req.workspace._id).populate('plan');
    return res.status(200).json({ success: true, workspace: ws });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWorkspaceSettings = async (req: AuthRequest, res: express.Response) => {
  try {
    const updated = await Workspace.findByIdAndUpdate(
      req.workspace._id,
      { $set: req.body },
      { new: true }
    );
    await logWorkspaceActivity(req, 'update', 'settings', { fields: Object.keys(req.body || {}) });
    return res.status(200).json({ success: true, workspace: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWorkspaceBusinessInfo = async (req: AuthRequest, res: express.Response) => {
  try {
    const updated = await Workspace.findByIdAndUpdate(
      req.workspace._id,
      { $set: req.body },
      { new: true }
    );
    await logWorkspaceActivity(req, 'update', 'workspace', { fields: Object.keys(req.body || {}) });
    return res.status(200).json({ success: true, message: 'Business information updated successfully', workspace: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Inbox / chat-assignment settings consumed by the support → Chat Assignment page.
const DEFAULT_INBOX_SETTINGS = {
  autoAssignmentEnabled: false,
  assignmentStrategy: 'MANUAL',
  maxConcurrentChats: 10,
  slaEnabled: false,
  slaFirstResponseMinutes: 60,
  slaResolutionMinutes: 1440,
  agentRateLimitEnabled: true,
  agentMessagesPerMinute: 30,
  softLockEnabled: true,
  softLockTimeoutSeconds: 60,
};

export const getInboxSettings = async (req: AuthRequest, res: express.Response) => {
  try {
    const ws = await Workspace.findById(req.workspace._id).select('inboxSettings').lean();
    const settings = { ...DEFAULT_INBOX_SETTINGS, ...((ws as any)?.inboxSettings || {}) };
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInboxSettings = async (req: AuthRequest, res: express.Response) => {
  try {
    const current = await Workspace.findById(req.workspace._id).select('inboxSettings').lean();
    const merged = { ...DEFAULT_INBOX_SETTINGS, ...((current as any)?.inboxSettings || {}), ...(req.body || {}) };
    await Workspace.findByIdAndUpdate(req.workspace._id, { $set: { inboxSettings: merged } });
    return res.status(200).json({ success: true, data: merged });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
