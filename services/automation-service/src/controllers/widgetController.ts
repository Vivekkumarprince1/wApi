import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WidgetConfig, Workspace } from '../models';
import mongoose from 'mongoose';

const DEFAULT_PRIMARY = '#25D366';

function normalizePhoneNumber(phone: unknown) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function buildWidgetId(workspaceId: unknown) {
  return `wapi_${String(workspaceId)}`;
}

function toPublicConfig(config: any, workspace: any) {
  const widgetId = config?.widgetId || buildWidgetId(workspace?._id || config?.workspace);
  const phoneNumber = normalizePhoneNumber(config?.phoneNumber || workspace?.bspPhoneNumberId || '');
  const enabled = Boolean(config?.enabled && phoneNumber);

  return {
    widgetId,
    workspaceId: String(workspace?._id || config?.workspace || ''),
    enabled,
    phoneNumber,
    position: config?.position || 'bottom-right',
    color: {
      primary: config?.color?.primary || DEFAULT_PRIMARY,
      secondary: config?.color?.secondary || '#1ea652',
      text: config?.color?.text || '#ffffff',
    },
    greeting: {
      enabled: config?.greeting?.enabled ?? true,
      text: config?.greeting?.text || 'Welcome! How can we help?',
      subtext: config?.greeting?.subtext || '',
    },
    defaultMessage: config?.defaultMessage || 'Hello! Thanks for reaching out.',
    behavior: {
      showByDefault: config?.behavior?.showByDefault ?? false,
      buttonLabel: config?.behavior?.buttonLabel || 'Chat with us',
      delayBeforeShow: Number(config?.behavior?.delayBeforeShow || 0),
      allowedPages: config?.behavior?.allowedPages?.length ? config.behavior.allowedPages : ['*'],
      excludedPages: config?.behavior?.excludedPages || [],
    },
    attribution: {
      enabled: config?.attribution?.enabled ?? true,
      customText: config?.attribution?.customText || 'Powered by wApi',
    },
    usage: config?.usage || {
      sessionsThisMonth: 0,
      messagesThisMonth: 0,
      uniqueVisitorsThisMonth: 0,
    },
  };
}

function toDashboardConfig(config: any, workspace: any) {
  const publicConfig = toPublicConfig(config, workspace);
  return {
    ...publicConfig,
    _id: config?._id,
    workspace: workspace?._id || config?.workspace,
    createdAt: config?.createdAt,
    updatedAt: config?.updatedAt,
  };
}

function normalizeWidgetPayload(body: any, workspace: any) {
  const phoneNumber = normalizePhoneNumber(body?.phoneNumber);
  const primary = body?.color?.primary || body?.themeColor || DEFAULT_PRIMARY;
  const greetingText = body?.greeting?.text || body?.bubbleText || body?.welcomeMessage || 'Welcome! How can we help?';
  const defaultMessage = body?.defaultMessage || body?.welcomeMessage || 'Hello! Thanks for reaching out.';

  return {
    widgetId: body?.widgetId || buildWidgetId(workspace._id),
    phoneNumber,
    enabled: Boolean(body?.enabled),
    position: body?.position || 'bottom-right',
    color: {
      primary,
      secondary: body?.color?.secondary || primary,
      text: body?.color?.text || '#ffffff',
    },
    greeting: {
      enabled: body?.greeting?.enabled ?? true,
      text: greetingText,
      subtext: body?.greeting?.subtext || '',
    },
    defaultMessage,
    conversation: {
      showHistory: body?.conversation?.showHistory ?? true,
      autoCloseAfter: Number(body?.conversation?.autoCloseAfter || 0),
      maxMessagesBeforeCollection: Number(body?.conversation?.maxMessagesBeforeCollection || 5),
      collectPhoneNumber: body?.conversation?.collectPhoneNumber ?? false,
      collectEmail: body?.conversation?.collectEmail ?? true,
      collectName: body?.conversation?.collectName ?? true,
    },
    behavior: {
      showByDefault: body?.behavior?.showByDefault ?? false,
      buttonLabel: body?.behavior?.buttonLabel || body?.bubbleText || 'Chat with us',
      allowedPages: Array.isArray(body?.behavior?.allowedPages) && body.behavior.allowedPages.length
        ? body.behavior.allowedPages
        : ['*'],
      excludedPages: Array.isArray(body?.behavior?.excludedPages) ? body.behavior.excludedPages : [],
      delayBeforeShow: Number(body?.behavior?.delayBeforeShow || 0),
    },
    attribution: {
      enabled: body?.attribution?.enabled ?? true,
      customText: body?.attribution?.customText || '',
    },
    workspace: workspace._id,
  };
}

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
        return res.json({
          success: true,
          data: toDashboardConfig(null, workspace)
        });
      }
      res.json({ success: true, data: toDashboardConfig(config, workspace) });
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

      const payload = normalizeWidgetPayload(req.body || {}, workspace);
      if (payload.enabled && !payload.phoneNumber) {
        return res.status(400).json({ success: false, message: "Phone number is required before enabling the widget" });
      }

      const config = await (WidgetConfig as any).findOneAndUpdate(
        { workspace: workspace._id },
        { $set: payload },
        { upsert: true, new: true }
      );
      res.json({ success: true, data: toDashboardConfig(config, workspace) });
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
      const scriptUrl = process.env.WIDGET_SCRIPT_URL || '/widget/runtime.js';
      const widgetId = buildWidgetId(workspaceId);
      
      const embedCode = `<!-- WApi Widget Start -->
<script src="${scriptUrl}" data-wapi-id="${widgetId}" async></script>
<!-- WApi Widget End -->`;

      res.json({
        success: true,
        data: {
          embedCode,
          widgetId,
          workspaceId,
          scriptUrl
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async getPublicConfig(req: AuthRequest, res: Response) {
    try {
      const widgetId = String(req.params.widgetId || '');
      if (!widgetId) return res.status(400).json({ success: false, message: 'Widget id is required' });

      const workspaceId = widgetId.startsWith('wapi_') ? widgetId.replace(/^wapi_/, '') : widgetId;
      const query = mongoose.Types.ObjectId.isValid(workspaceId)
        ? { $or: [{ widgetId }, { workspace: new mongoose.Types.ObjectId(workspaceId) }] }
        : { widgetId };

      const config = await (WidgetConfig as any).findOne(query);
      const workspace = config
        ? await (Workspace as any).findById(config.workspace)
        : mongoose.Types.ObjectId.isValid(workspaceId)
          ? await (Workspace as any).findById(workspaceId)
          : null;

      if (!workspace) return res.status(404).json({ success: false, message: 'Widget not found' });

      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({ success: true, data: toPublicConfig(config, workspace) });
    } catch (err: any) {
      console.error("[Widget getPublicConfig Error]:", err.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  async trackPublicEvent(req: AuthRequest, res: Response) {
    try {
      const widgetId = String(req.params.widgetId || '');
      const type = String(req.body?.type || '');
      if (!widgetId || !['impression', 'click', 'message'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid widget event' });
      }

      const workspaceId = widgetId.startsWith('wapi_') ? widgetId.replace(/^wapi_/, '') : widgetId;
      const query = mongoose.Types.ObjectId.isValid(workspaceId)
        ? { $or: [{ widgetId }, { workspace: new mongoose.Types.ObjectId(workspaceId) }] }
        : { widgetId };
      const increment: Record<string, number> = {};
      if (type === 'impression') increment['usage.sessionsThisMonth'] = 1;
      if (type === 'click') increment['usage.uniqueVisitorsThisMonth'] = 1;
      if (type === 'message') increment['usage.messagesThisMonth'] = 1;

      await (WidgetConfig as any).findOneAndUpdate(query, {
        $inc: increment,
        $set: { 'usage.lastActivityAt': new Date() }
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Widget trackPublicEvent Error]:", err.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
};
