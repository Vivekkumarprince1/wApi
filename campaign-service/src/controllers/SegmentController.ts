import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Segment } from '../models';

export const listSegments = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const segments = await Segment.find({ workspace: workspaceId })
      .select('name description filters contactCount lastResolvedAt createdAt')
      .sort({ createdAt: -1 }).lean();
    res.json({ success: true, segments, total: segments.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createSegment = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const userId = req.user?.id;
    const { name, description, filters } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Segment name is required' });

    const segment = await Segment.create({
      workspace: workspaceId,
      name, description,
      filters: filters || {},
      contactCount: 0,
      lastResolvedAt: new Date(),
      createdBy: userId
    });
    res.status(201).json({ success: true, segment, message: 'Segment created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSegmentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const segment = await Segment.findOne({ _id: id, workspace: workspaceId }).lean();
    if (!segment) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, segment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSegment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const segment = await Segment.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    if (!segment) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, segment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteSegment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const segment = await Segment.findOneAndDelete({ _id: id, workspace: workspaceId });
    if (!segment) return res.status(404).json({ success: false, message: 'Segment not found' });
    res.json({ success: true, message: 'Segment deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
