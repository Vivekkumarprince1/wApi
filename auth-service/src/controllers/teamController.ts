import express from 'express';
import { Team } from '../models/index.js';
import { AuthRequest } from '../middleware/businessAuth.js';

export const listTeams = async (req: AuthRequest, res: express.Response) => {
  try {
    const teams = await Team.find({ workspace: req.workspace._id, isActive: true }).populate('members.user', 'name email');
    return res.status(200).json({ success: true, data: teams });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTeam = async (req: AuthRequest, res: express.Response) => {
  try {
    const { name, description, members = [] } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: 'Team name is required' });
    }

    const team = await Team.create({
      workspace: req.workspace._id,
      name: String(name).trim(),
      description,
      members: members.map((m: any) => ({
        user: m.user || m,
        role: m.role || 'member'
      })),
      createdBy: req.user._id
    });

    return res.status(201).json({ success: true, data: team });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeam = async (req: AuthRequest, res: express.Response) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, workspace: req.workspace._id }).populate('members.user', 'name email');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    return res.status(200).json({ success: true, data: team });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTeam = async (req: AuthRequest, res: express.Response) => {
  try {
    const team = await Team.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { $set: req.body },
      { new: true }
    );
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    return res.status(200).json({ success: true, data: team });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTeam = async (req: AuthRequest, res: express.Response) => {
  try {
    const team = await Team.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspace._id },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    return res.status(200).json({ success: true, message: 'Team deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
