import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { SupportTicket, Macro } from '../models';

export const supportController = {
  // --- TICKETS ---
  
  async listTickets(req: AuthRequest, res: Response) {
    try {
      const tickets = await SupportTicket.find({ workspace: req.workspace._id })
        .populate('assignedTo', 'name email')
        .populate('contact', 'name phone')
        .sort({ updatedAt: -1 });
      res.json({ success: true, data: tickets });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async createTicket(req: AuthRequest, res: Response) {
    try {
      const ticket = await SupportTicket.create({
        ...req.body,
        workspace: req.workspace._id,
        createdBy: req.user._id
      });
      res.json({ success: true, data: ticket });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async updateTicket(req: AuthRequest, res: Response) {
    try {
      const ticket = await SupportTicket.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { $set: req.body },
        { new: true }
      );
      res.json({ success: true, data: ticket });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  // --- MACROS ---

  async listMacros(req: AuthRequest, res: Response) {
    try {
      const macros = await Macro.find({ 
        workspace: req.workspace._id, 
        $or: [
          { isActive: true },
          { isActive: { $exists: false } }
        ]
      });
      res.json({ success: true, data: macros });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async createMacro(req: AuthRequest, res: Response) {
    try {
      const { name, content, shortcut, isActive } = req.body;
      const macro = await Macro.create({
        name,
        content,
        shortcut: shortcut || '',
        isActive: isActive !== false,
        workspace: req.workspace._id,
        createdBy: req.user._id
      });
      res.json({ success: true, data: macro });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async updateMacro(req: AuthRequest, res: Response) {
    try {
      const { name, content, shortcut, isActive } = req.body;
      const macro = await Macro.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { 
          $set: { 
            name, 
            content, 
            shortcut: shortcut || '', 
            isActive: isActive !== false 
          } 
        },
        { new: true }
      );
      if (!macro) return res.status(404).json({ success: false, message: "Macro not found" });
      res.json({ success: true, data: macro });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async deleteMacro(req: AuthRequest, res: Response) {
    try {
      await Macro.findOneAndDelete({ _id: req.params.id, workspace: req.workspace._id });
      res.json({ success: true, message: "Macro deleted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
};
