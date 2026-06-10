import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WidgetConfig, Workspace } from '../models';

export const widgetController = {
  /**
   * Get widget configuration
   */
  async getConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const workspace = await (Workspace as any).findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      let config = await (WidgetConfig as any).findOne({ workspace: workspace._id });
      if (!config) {
        // Return default config if not found
        return res.json({
          success: true,
          data: {
            workspace: workspace._id,
            phoneNumber: (workspace as any).bspPhoneNumberId || '',
            bubbleText: "Chat with us",
            welcomeMessage: "Hi! How can we help you today?",
            position: 'right',
            themeColor: '#25D366'
          }
        });
      }
      res.json({ success: true, data: config });
    } catch (err: any) {
      console.error("[Widget getConfig Error]:", err.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Update widget configuration
   */
  async updateConfig(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const workspace = await (Workspace as any).findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      const config = await (WidgetConfig as any).findOneAndUpdate(
        { workspace: workspace._id },
        { $set: { ...req.body, workspace: workspace._id } },
        { upsert: true, new: true }
      );
      res.json({ success: true, data: config });
    } catch (err: any) {
      console.error("[Widget updateConfig Error]:", err.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Get embed code for the widget
   */
  async getEmbedCode(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const scriptUrl = process.env.WIDGET_SCRIPT_URL || 'https://cdn.wapi.com/widget.js';
      
      const embedCode = `<!-- WApi Widget Start -->
<script src="${scriptUrl}" data-wapi-id="${workspaceId}" async></script>
<!-- WApi Widget End -->`;

      res.json({
        success: true,
        data: {
          embedCode,
          workspaceId,
          scriptUrl
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
};
