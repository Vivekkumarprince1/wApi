import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WhatsAppFlow, Workspace } from '../models';
import { BspServiceClient } from '../services/external';

export const flowController = {
  /**
   * List all flows for a workspace
   */
  async listFlows(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const flows = await (WhatsAppFlow as any).find({ workspace: workspaceId }).sort({ createdAt: -1 });
      res.json({ success: true, data: flows });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create a new flow
   */
  async createFlow(req: AuthRequest, res: Response) {
    try {
      const { name, categories } = req.body;
      const workspaceId = req.workspace?.id || req.workspace?._id;

      const workspace = await (Workspace as any).findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      const gupshupAppId = (workspace as any).gupshupAppId;
      if (!gupshupAppId) {
        return res.status(400).json({ success: false, message: "WhatsApp not configured (Missing Gupshup App ID)" });
      }

      // 1. Create on provider through bsp-service
      const gsResult: any = await BspServiceClient.providerAction({
        workspaceId: workspace._id.toString(),
        appId: gupshupAppId,
        action: 'create_flow',
        payload: { name, categories }
      });
      const providerFlowId = gsResult.flowId || gsResult.id;
      if (!providerFlowId) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'INVALID_PROVIDER_RESPONSE',
            message: 'The WhatsApp provider did not create a flow',
            requestId: req.headers['x-correlation-id'] || null,
          },
        });
      }

      // 2. Save locally
      const flow = await (WhatsAppFlow as any).create({
        workspace: workspace._id,
        name,
        categories,
        gupshupFlowId: providerFlowId,
        status: 'DRAFT'
      });

      res.status(201).json({ success: true, data: flow });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get flow details
   */
  async getFlow(req: AuthRequest, res: Response) {
    try {
      const { flowId } = req.params;
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const flow = await (WhatsAppFlow as any).findOne({ _id: flowId, workspace: workspaceId });
      if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

      res.json({ success: true, data: flow });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Execute flow action (sync, publish, deprecate, etc)
   */
  async executeAction(req: AuthRequest, res: Response) {
    try {
      const { flowId } = req.params;
      const { action, json, name, categories } = req.body;
      const workspaceId = req.workspace?.id || req.workspace?._id;

      const workspace = await (Workspace as any).findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ success: false, message: "Workspace not found" });
      }

      const flow = await (WhatsAppFlow as any).findOne({ _id: flowId, workspace: workspace._id });
      if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

      const gupshupAppId = (workspace as any).gupshupAppId;
      if (!gupshupAppId) {
        return res.status(400).json({ success: false, message: "WhatsApp not configured (Missing Gupshup App ID)" });
      }

      const gFlowId = (flow as any).gupshupFlowId;
      if (!gFlowId) return res.status(400).json({ success: false, message: "Flow not synced with BSP" });

      let result: any = null;

      switch (action) {
        case 'updateJson':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: gupshupAppId,
            action: 'update_flow_json',
            payload: { flowId: gFlowId, name: name || flow.name, json }
          });
          break;

        case 'updateCategories':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: gupshupAppId,
            action: 'update_flow',
            payload: { flowId: gFlowId, categories }
          });
          flow.categories = categories;
          await flow.save();
          break;

        case 'preview':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: gupshupAppId,
            action: 'get_flow_preview_url',
            payload: { flowId: gFlowId }
          });
          if (result?.preview_url || result?.data?.preview_url) {
            (flow as any).previewUrl = result.preview_url || result.data.preview_url;
            await flow.save();
          }
          break;

        case 'publish':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: gupshupAppId,
            action: 'publish_flow',
            payload: { flowId: gFlowId }
          });
          flow.status = 'PUBLISHED';
          await flow.save();
          break;

        case 'deprecate':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: gupshupAppId,
            action: 'deprecate_flow',
            payload: { flowId: gFlowId }
          });
          flow.status = 'DEPRECATED';
          await flow.save();
          break;

        case 'sync':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: gupshupAppId,
            action: 'get_flow_by_id',
            payload: { flowId: gFlowId }
          });
          if (result) {
            flow.status = result.status || flow.status;
            flow.categories = result.categories || flow.categories;
            await flow.save();
          }
          break;

        default:
          return res.status(400).json({ success: false, message: "Invalid action" });
      }

      res.json({ success: true, message: `Action ${action} executed`, data: result, flow });
    } catch (err: any) {
      console.error("[Flow Action Error]:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete flow
   */
  async deleteFlow(req: AuthRequest, res: Response) {
    try {
      const { flowId } = req.params;
      const workspaceId = req.workspace?.id || req.workspace?._id;
      const flow = await (WhatsAppFlow as any).findOne({ _id: flowId, workspace: workspaceId });
      if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

      await (WhatsAppFlow as any).deleteOne({ _id: flowId });
      res.json({ success: true, message: "Flow deleted locally" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
