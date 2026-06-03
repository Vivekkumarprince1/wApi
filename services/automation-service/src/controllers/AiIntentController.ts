import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AutomationRule } from '../models';

export const getAiIntentRules = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const { Types } = await import('mongoose');
    const workspaceFilter = workspaceId.length === 24 
      ? { $in: [workspaceId, new Types.ObjectId(workspaceId)] }
      : workspaceId;

    const query: any = { 
      workspace: workspaceFilter, 
      'trigger.type': 'ai_intent',
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
      ]
    };
    const rules = await AutomationRule.find(query).lean();
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAiIntentRuleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.findOne({ _id: id, workspace: workspaceId, 'trigger.type': 'ai_intent' }).lean();
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createAiIntentRule = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.create({
      ...req.body,
      workspace: workspaceId,
      trigger: {
        ...(req.body.trigger || {}),
        event: 'ai_intent_matched',
        type: 'ai_intent'
      }
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateAiIntentRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: id, workspace: workspaceId, 'trigger.type': 'ai_intent' },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteAiIntentRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: id, workspace: workspaceId, 'trigger.type': 'ai_intent' },
      { $set: { deletedAt: new Date(), enabled: false } },
      { returnDocument: 'after' }
    );
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, data: { message: 'Rule deleted' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
