import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { InteraktiveList } from '../models';

export const getLists = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const { enabled, search } = req.query;

    const query: any = { 
      workspace: workspaceId, 
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
      ]
    };
    if (enabled !== undefined) query.enabled = enabled === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const lists = await InteraktiveList.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: lists });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getListById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const list = await InteraktiveList.findOne({ _id: id, workspace: workspaceId }).lean();
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createList = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const list = await InteraktiveList.create({
      ...req.body,
      workspace: workspaceId
    });
    res.status(201).json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateList = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const list = await InteraktiveList.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteList = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const list = await InteraktiveList.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      { $set: { deletedAt: new Date(), enabled: false } },
      { returnDocument: 'after' }
    );
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });
    res.json({ success: true, data: { message: 'List deleted' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
