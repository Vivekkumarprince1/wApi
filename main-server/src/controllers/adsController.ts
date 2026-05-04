import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { WhatsAppAd } from '../models';

export const adsController = {
  /**
   * List all ads
   */
  async listAds(req: AuthRequest, res: Response) {
    try {
      const ads = await WhatsAppAd.find({ workspace: req.workspace._id }).sort({ createdAt: -1 });
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
      const ad = await WhatsAppAd.create({
        ...req.body,
        workspace: req.workspace._id,
        createdBy: req.user._id
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
      const ad = await WhatsAppAd.findOne({ _id: req.params.id, workspace: req.workspace._id });
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
      const ad = await WhatsAppAd.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
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
      const ad = await WhatsAppAd.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
      if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
      res.json({ success: true, message: "Ad deleted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
  }
};
