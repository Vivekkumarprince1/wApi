import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Template } from '../models';
import { WabaService } from '../services/messaging/waba-service';
import { proxyController } from './proxyController';

export const templateController = {
  /**
   * List Workspace Templates
   */
  async listTemplates(req: AuthRequest, res: Response) {
    try {
      const query: any = { 
        workspace: req.workspace._id,
        isDeleted: { $ne: true }
      };

      // Support filtering by status (e.g. APPROVED)
      if (req.query.status) {
        query.status = req.query.status;
      }

      // Default to showing only the active version of templates
      if (req.query.isActiveVersion !== undefined) {
        query.isActiveVersion = req.query.isActiveVersion === 'true';
      } else {
        query.isActiveVersion = true;
      }

      const templates = await Template.find(query).sort({ createdAt: -1 });
      res.json({ success: true, data: templates });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
  
  /**
   * List Template Categories
   */
  async getCategories(req: AuthRequest, res: Response) {
    try {
      const categoriesAgg = await Template.aggregate([
        { 
          $match: { 
            workspace: req.workspace._id,
            isDeleted: { $ne: true }
          } 
        },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      const activeCategories = categoriesAgg.map(item => item._id).filter(Boolean);
      const defaults = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
      const uniqueCategories = Array.from(new Set([...defaults, ...activeCategories]));

      res.json({
        success: true,
        categories: uniqueCategories,
        activeCounts: categoriesAgg.reduce((acc: any, item: any) => {
          if (item._id) acc[item._id] = item.count;
          return acc;
        }, {})
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Sync Templates with Gupshup
   */
  async syncTemplates(req: AuthRequest, res: Response) {
    try {
      const result = await WabaService.syncTemplates(req.workspace._id);
      res.json(result);
    } catch (err: any) {
      console.error('[TemplateController:Sync] Error:', err.message);
      res.status(500).json({ 
        success: false, 
        message: err.message || "Sync failed"
      });
    }
  },

  async createTemplate(req: AuthRequest, res: Response) {
    try {
      const template = await Template.create({
        ...req.body,
        workspace: req.workspace._id,
        createdBy: req.user._id,
        language: req.body.language || 'en',
        category: req.body.category || 'MARKETING',
        status: req.body.status || 'DRAFT',
        templateType: req.body.templateType || 'STANDARD',
        source: req.body.source || 'LOCAL'
      });
      res.status(201).json({ success: true, data: template });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * Get Single Template
   */
  async getTemplate(req: AuthRequest, res: Response) {
    try {
      const template = await Template.findOne({ _id: req.params.id, workspace: req.workspace._id });
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json({ success: true, data: template });
    } catch (err: any) {
      res.status(500).json({ message: "Server Error" });
    }
  },

  /**
   * Update Template
   */
  async updateTemplate(req: AuthRequest, res: Response) {
    try {
      const template = await Template.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { $set: req.body },
        { new: true }
      );
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json({ success: true, data: template });
    } catch (err: any) {
      res.status(500).json({ message: "Update failed" });
    }
  },

  async submitTemplate(req: AuthRequest, res: Response) {
    try {
      const template = await Template.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { $set: { status: 'PENDING', submittedAt: new Date(), submittedVia: 'BSP' } },
        { new: true }
      );
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json({ success: true, data: template, message: "Template submitted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete Template
   */
  async deleteTemplate(req: AuthRequest, res: Response) {
    try {
      const template = await Template.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { $set: { isDeleted: true } },
        { new: true }
      );
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json({ success: true, message: "Template deleted" });
    } catch (err: any) {
      res.status(500).json({ message: "Delete failed" });
    }
  },

  /**
   * Get template analytics
   */
  async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const { Message } = await import('../models');
      const stats = await Message.aggregate([
        { $match: { workspace: req.workspace._id, direction: 'outbound', template: { $exists: true } } },
        { 
          $group: { 
            _id: null,
            sent: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } }
          } 
        }
      ]);

      const main = stats[0] || { sent: 0, delivered: 0, read: 0 };
      
      const perTemplate = await Message.aggregate([
        { $match: { workspace: req.workspace._id, direction: 'outbound', template: { $exists: true } } },
        {
          $group: {
            _id: "$template",
            count: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      res.json({
        success: true,
        data: {
          metrics: [
            { label: "Sent", value: main.sent },
            { label: "Delivered", value: main.delivered },
            { label: "Read", value: main.read }
          ],
          items: perTemplate.map(t => ({
            id: t._id,
            count: t.count,
            performance: t.count > 0 ? Math.round((t.read / t.count) * 100) : 0
          }))
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get library stats
   */
  async getLibraryStats(req: AuthRequest, res: Response) {
    // Ported from monolith mock
    res.json({
      success: true,
      data: {
        total: 120,
        approved: 95,
        rejected: 5,
        pending: 20
      }
    });
  },

  async listRules(req: AuthRequest, res: Response) {
    try {
      const response = await proxyController.forwardToService('automation', {
        method: 'GET',
        path: '/api/automation/engine/rules',
        params: { category: 'template_rule' },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      const rules = Array.isArray(response.data?.data?.rules) ? response.data.data.rules : [];
      res.status(response.status).json({ success: true, data: rules });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createRule(req: AuthRequest, res: Response) {
    try {
      const response = await proxyController.forwardToService('automation', {
        method: 'POST',
        path: '/api/automation/engine/rules',
        data: {
        ...req.body,
        workspace: req.workspace._id,
        category: 'template_rule',
        enabled: req.body.enabled ?? req.body.active ?? true,
        createdBy: req.user._id
        },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateRule(req: AuthRequest, res: Response) {
    try {
      const response = await proxyController.forwardToService('automation', {
        method: 'PATCH',
        path: `/api/automation/engine/rules/${req.params.id}`,
        data: { ...req.body, updatedBy: req.user._id, category: 'template_rule' },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteRule(req: AuthRequest, res: Response) {
    try {
      const response = await proxyController.forwardToService('automation', {
        method: 'DELETE',
        path: `/api/automation/engine/rules/${req.params.id}`,
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async toggleRule(req: AuthRequest, res: Response) {
    try {
      const active = req.body.active ?? req.body.enabled;
      const response = await proxyController.forwardToService('automation', {
        method: 'PATCH',
        path: `/api/automation/engine/rules/${req.params.id}/toggle`,
        data: { enabled: !!active },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async testRule(req: AuthRequest, res: Response) {
    res.json({ success: true, matched: true, data: { ruleId: req.params.id, payload: req.body || {} } });
  },

  async getRuleStats(req: AuthRequest, res: Response) {
    res.json({ success: true, data: { ruleId: req.params.id, triggered: 0, sent: 0, failed: 0 } });
  }
};
