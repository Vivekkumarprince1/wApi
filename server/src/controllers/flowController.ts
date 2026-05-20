import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { WhatsAppFlow } from '../models';
import { BspServiceClient } from '../services/microservices/bsp-service-client';

export const flowController = {
  /**
   * List all flows for a workspace
   */
  async listFlows(req: AuthRequest, res: Response) {
    try {
      const flows = await WhatsAppFlow.find({ workspace: req.workspace._id }).sort({ createdAt: -1 });
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
      const workspace = req.workspace;

      if (!workspace.gupshupAppId) {
        return res.status(400).json({ success: false, message: "WhatsApp not configured" });
      }

      // 1. Create on provider through bsp-service
      const gsResult: any = await BspServiceClient.providerAction({
        workspaceId: workspace._id.toString(),
        appId: workspace.gupshupAppId,
        action: 'create_flow',
        payload: { name, categories }
      });
      
      // 2. Save locally
      const flow = await WhatsAppFlow.create({
        workspace: workspace._id,
        name,
        categories,
        gupshupFlowId: gsResult.flowId || gsResult.id,
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
      const flow = await WhatsAppFlow.findOne({ _id: flowId, workspace: req.workspace._id });
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
      const workspace = req.workspace;

      const flow = await WhatsAppFlow.findOne({ _id: flowId, workspace: workspace._id });
      if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

      if (!workspace.gupshupAppId) {
        return res.status(400).json({ success: false, message: "WhatsApp not configured" });
      }

      const gFlowId = (flow as any).gupshupFlowId;
      if (!gFlowId) return res.status(400).json({ success: false, message: "Flow not synced with BSP" });

      let result: any = null;

      switch (action) {
        case 'updateJson':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: workspace.gupshupAppId,
            action: 'update_flow_json',
            payload: { flowId: gFlowId, name: name || flow.name, json }
          });
          break;

        case 'updateCategories':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: workspace.gupshupAppId,
            action: 'update_flow',
            payload: { flowId: gFlowId, categories }
          });
          flow.categories = categories;
          await flow.save();
          break;

        case 'preview':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: workspace.gupshupAppId,
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
            appId: workspace.gupshupAppId,
            action: 'publish_flow',
            payload: { flowId: gFlowId }
          });
          flow.status = 'PUBLISHED';
          await flow.save();
          break;

        case 'deprecate':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: workspace.gupshupAppId,
            action: 'deprecate_flow',
            payload: { flowId: gFlowId }
          });
          flow.status = 'DEPRECATED';
          await flow.save();
          break;

        case 'sync':
          result = await BspServiceClient.providerAction({
            workspaceId: workspace._id.toString(),
            appId: workspace.gupshupAppId,
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
      const flow = await WhatsAppFlow.findOne({ _id: flowId, workspace: req.workspace._id });
      if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

      // We don't necessarily delete on Gupshup side automatically unless confirmed
      await WhatsAppFlow.deleteOne({ _id: flowId });
      res.json({ success: true, message: "Flow deleted locally" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
