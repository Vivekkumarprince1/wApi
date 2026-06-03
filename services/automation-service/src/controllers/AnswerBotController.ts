import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AnswerBotSettings, AnswerBotSource } from '../models';

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    let settings = await AnswerBotSettings.findOne({ workspace: workspaceId });
    if (!settings) {
      settings = await AnswerBotSettings.create({
        workspace: workspaceId,
        enabled: false,
        personaName: 'Smart Assistant'
      });
    }
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const settings = await AnswerBotSettings.findOneAndUpdate(
      { workspace: workspaceId },
      { $set: req.body },
      { returnDocument: 'after', upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSources = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const sources = await AnswerBotSource.find({ workspace: workspaceId }).sort({ createdAt: -1 });
    res.json({ success: true, data: sources });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createSource = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const source = await AnswerBotSource.create({
      ...req.body,
      workspace: workspaceId
    });
    res.status(201).json({ success: true, data: source });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
