import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { QuickReply, Tag } from '../models/index.js';
import { publishContactEvent } from '../services/eventBus.js';

function workspaceId(req: AuthRequest) {
  return req.workspace?._id || req.workspace?.id || req.headers['x-workspace-id'];
}

export const workspaceMessagingController = {
  async listTags(req: AuthRequest, res: Response) {
    const tags = await Tag.find({ workspace: workspaceId(req) }).sort({ createdAt: -1 });
    return res.json({ success: true, data: tags, tags });
  },

  async createTag(req: AuthRequest, res: Response) {
    const tag = await Tag.create({
      ...req.body,
      workspace: workspaceId(req),
      createdBy: req.user?._id
    });
    await publishContactEvent('tag_created', String(workspaceId(req)), { tag });
    return res.json({ success: true, data: tag, tag });
  },

  async deleteTag(req: AuthRequest, res: Response) {
    await Tag.findOneAndDelete({ _id: req.params.id, workspace: workspaceId(req) });
    await publishContactEvent('tag_deleted', String(workspaceId(req)), { tagId: req.params.id });
    return res.json({ success: true });
  },

  async listQuickReplies(req: AuthRequest, res: Response) {
    const replies = await QuickReply.find({
      workspace: workspaceId(req),
      $or: [
        { scope: 'workspace' },
        { scope: 'personal', owner: req.user?._id }
      ],
      isActive: { $ne: false }
    }).sort({ createdAt: -1 });
    return res.json({ success: true, data: replies, quickReplies: replies });
  },

  async saveQuickReply(req: AuthRequest, res: Response) {
    const { id, scope = 'workspace', ...data } = req.body || {};
    const owner = scope === 'personal' ? req.user?._id : undefined;

    if (id || req.params.id) {
      const replyId = id || req.params.id;
      const existing = await QuickReply.findById(replyId);
      if (existing?.scope === 'personal' && String(existing.owner) !== String(req.user?._id)) {
        return res.status(403).json({ success: false, message: "Cannot modify another user's personal reply" });
      }
      const reply = await QuickReply.findOneAndUpdate(
        { _id: replyId, workspace: workspaceId(req) },
        { $set: { ...data, scope, owner } },
        { new: true, runValidators: true }
      );
      await publishContactEvent('quick_reply_saved', String(workspaceId(req)), { quickReply: reply });
      return res.json({ success: true, data: reply, quickReply: reply });
    }

    const reply = await QuickReply.create({
      ...data,
      workspace: workspaceId(req),
      scope,
      owner,
      createdBy: req.user?._id
    });
    await publishContactEvent('quick_reply_saved', String(workspaceId(req)), { quickReply: reply });
    return res.json({ success: true, data: reply, quickReply: reply });
  },

  async deleteQuickReply(req: AuthRequest, res: Response) {
    const existing = await QuickReply.findById(req.params.id);
    if (existing?.scope === 'personal' && String(existing.owner) !== String(req.user?._id)) {
      return res.status(403).json({ success: false, message: "Cannot delete another user's personal reply" });
    }
    await QuickReply.findOneAndDelete({ _id: req.params.id, workspace: workspaceId(req) });
    await publishContactEvent('quick_reply_deleted', String(workspaceId(req)), { quickReplyId: req.params.id });
    return res.json({ success: true });
  }
};
