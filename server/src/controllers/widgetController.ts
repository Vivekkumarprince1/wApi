import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { WidgetConfig } from '../models';

export const widgetController = {
  /**
   * Get widget configuration
   */
  async getConfig(req: AuthRequest, res: Response) {
    try {
      let config = await WidgetConfig.findOne({ workspace: req.workspace._id });
      if (!config) {
        // Return default config if not found
        return res.json({
          success: true,
          data: {
            workspace: req.workspace._id,
            phoneNumber: req.workspace.bspPhoneNumberId || '',
            bubbleText: "Chat with us",
            welcomeMessage: "Hi! How can we help you today?",
            position: 'right',
            themeColor: '#25D366'
          }
        });
      }
      res.json({ success: true, data: config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Update widget configuration
   */
  async updateConfig(req: AuthRequest, res: Response) {
    try {
      const config = await WidgetConfig.findOneAndUpdate(
        { workspace: req.workspace._id },
        { $set: { ...req.body, workspace: req.workspace._id } },
        { upsert: true, new: true }
      );
      res.json({ success: true, data: config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Get embed code for the widget
   */
  async getEmbedCode(req: AuthRequest, res: Response) {
    const workspaceId = req.workspace._id;
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
  }
};
