import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { InstagramQuickflow } from '../models/InstagramQuickflow';

export const getQuickflows = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const enabled = req.query.enabled;
    const type = req.query.type;
    const triggerType = req.query.triggerType;

    const { Types } = await import('mongoose');
    const workspaceFilter = workspaceId.length === 24 
      ? { $in: [workspaceId, new Types.ObjectId(workspaceId)] }
      : workspaceId;

    const query: any = { workspace: workspaceFilter };
    if (enabled !== undefined) query.enabled = enabled === 'true';
    if (type) query.type = type;
    if (triggerType) query.triggerType = triggerType;

    const quickflows = await InstagramQuickflow.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: quickflows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createQuickflow = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const data = req.body;

    if (!data.name || !data.type || !data.triggerType) {
      return res.status(400).json({ success: false, error: 'Name, type, and triggerType are required' });
    }

    const quickflow = await InstagramQuickflow.create({
      ...data,
      workspace: workspaceId,
      keywords: data.keywords?.map((k: string) => k.toLowerCase()) || []
    });

    res.status(201).json(quickflow);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getQuickflowById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const quickflow = await InstagramQuickflow.findOne({ _id: id, workspace: workspaceId }).lean();
    if (!quickflow) return res.status(404).json({ success: false, error: 'Quickflow not found' });
    res.json({ success: true, data: quickflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateQuickflow = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const quickflow = await InstagramQuickflow.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    if (!quickflow) return res.status(404).json({ success: false, error: 'Quickflow not found' });
    res.json({ success: true, data: quickflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteQuickflow = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const quickflow = await InstagramQuickflow.findOneAndDelete({ _id: id, workspace: workspaceId });
    if (!quickflow) return res.status(404).json({ success: false, error: 'Quickflow not found' });
    res.json({ success: true, message: 'Quickflow deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
