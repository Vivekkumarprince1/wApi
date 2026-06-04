import express from 'express';
import { Role, Permission } from '../models/index.js';
import { AuthRequest } from '../middleware/businessAuth.js';

export const listRoles = async (req: AuthRequest, res: express.Response) => {
  try {
    const systemRoles = ['owner', 'admin', 'manager', 'agent', 'viewer'].map(r => ({
      _id: `system_${r}`,
      name: r.charAt(0).toUpperCase() + r.slice(1),
      slug: r,
      isSystem: true,
      permissions: (Permission as any).getDefaultPermissions ? (Permission as any).getDefaultPermissions(r) : ['*']
    }));
    const customRoles = await Role.find({ workspace: req.workspace._id });
    return res.status(200).json({ success: true, data: [...systemRoles, ...customRoles] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Permissions matrix consumed by the settings → Permissions tab.
 * Returns the default permission map for each system role keyed by role slug,
 * e.g. { owner: { permissions: {...} }, admin: { permissions: {...} }, ... }.
 */
export const getPermissionsMatrix = async (_req: AuthRequest, res: express.Response) => {
  try {
    const roles = ['owner', 'admin', 'manager', 'agent', 'viewer'];
    const matrix: Record<string, { name: string; permissions: any }> = {};
    for (const r of roles) {
      matrix[r] = {
        name: r.charAt(0).toUpperCase() + r.slice(1),
        permissions: (Permission as any).getDefaultPermissions
          ? (Permission as any).getDefaultPermissions(r)
          : {}
      };
    }
    return res.status(200).json({ success: true, data: matrix });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createRole = async (req: AuthRequest, res: express.Response) => {
  try {
    const { name, permissions, color } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const role = await Role.create({
      workspace: req.workspace._id,
      name: String(name).trim(),
      slug: String(name).trim().toLowerCase().replace(/\s+/g, '_'),
      permissions: permissions || {},
      color: color || 'slate',
      isSystem: false
    });

    return res.status(201).json({ success: true, data: role });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRole = async (req: AuthRequest, res: express.Response) => {
  try {
    const role = await Role.findOne({ _id: req.params.id, workspace: req.workspace._id });
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    return res.status(200).json({ success: true, data: role });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRole = async (req: AuthRequest, res: express.Response) => {
  try {
    const role = await Role.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { $set: req.body },
      { new: true }
    );
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    return res.status(200).json({ success: true, data: role });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRole = async (req: AuthRequest, res: express.Response) => {
  try {
    const role = await Role.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    return res.status(200).json({ success: true, message: 'Role deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
