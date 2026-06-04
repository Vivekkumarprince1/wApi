import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WhatsAppAd } from '../models';

export const adsController = {
  /**
   * List all ads
   */
  async listAds(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const ads = await (WhatsAppAd as any).find({ workspace: workspaceId }).sort({ createdAt: -1 });
      res.json({ success: true, data: ads });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Create new ad
   */
  async createAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const userId = req.user?.id || req.user?._id;
      const ad = await (WhatsAppAd as any).create({
        ...req.body,
        workspace: workspaceId,
        createdBy: userId
      });
      res.json({ success: true, data: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Get ad details
   */
  async getAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const ad = await (WhatsAppAd as any).findOne({ _id: req.params.id, workspace: workspaceId });
      if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
      res.json({ success: true, data: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Update ad
   */
  async updateAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const ad = await (WhatsAppAd as any).findOneAndUpdate(
        { _id: req.params.id, workspace: workspaceId },
        { $set: req.body },
        { new: true }
      );
      if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
      res.json({ success: true, data: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  },

  /**
   * Delete ad
   */
  async deleteAd(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const ad = await (WhatsAppAd as any).findOneAndDelete({ _id: req.params.id, workspace: workspaceId });
      if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
      res.json({ success: true, message: "Ad deleted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  }
};
