import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { DealService } from '../services/commerce/deal-service';
import { PipelineService } from '../services/commerce/pipeline-service';
import { TaskService } from '../services/commerce/task-service';
import { Deal, Pipeline, Task } from '../models';
import mongoose from 'mongoose';
import { proxyController } from './proxyController';

export const crmController = {
  /**
   * List Pipelines
   */
  async getPipelines(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      let pipelines = await Pipeline.find({ workspace: workspace._id }).sort({ createdAt: -1 });

      // If no pipelines exist, create the default one automatically (Parity fix)
      if (pipelines.length === 0) {
        const defaultStages = [
          { id: 'leads', title: 'Leads', position: 0, color: '#6B7280' },
          { id: 'qualified', title: 'Qualified', position: 1, color: '#3B82F6' },
          { id: 'proposal', title: 'Proposal', position: 2, color: '#8B5CF6' },
          { id: 'won', title: 'Won', position: 3, isFinal: true, color: '#10B981' },
          { id: 'lost', title: 'Lost', position: 4, isFinal: true, color: '#EF4444' }
        ];

        const defaultPipeline = await Pipeline.create({
          workspace: workspace._id,
          name: 'Default Sales Pipeline',
          stages: defaultStages,
          isDefault: true
        });
        
        pipelines = [defaultPipeline];
      }

      res.json({ success: true, data: pipelines });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * List Deals
   */
  async getDeals(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const { pipelineId, contactId, stage, status = 'active', search } = req.query;
      const page = parseInt(req.query.page as string || "1");
      const limit = parseInt(req.query.limit as string || "50");
      
      const query: any = { workspace: workspace._id };
      if (pipelineId) query.pipeline = pipelineId;
      if (contactId) query.contact = contactId;
      if (stage) query.stage = stage;
      if (status && status !== 'all') query.status = status;

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } }
        ];
      }

      const [deals, total] = await Promise.all([
        Deal.find(query)
          .populate('contact', 'name phone avatar')
          .populate('assignedAgent', 'name email')
          .populate('pipeline', 'name')
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip((page - 1) * limit),
        Deal.countDocuments(query)
      ]);

      res.json({ 
        success: true, 
        data: deals,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get Deal Details
   */
  async getDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const deal = await Deal.findOne({ _id: id, workspace: req.workspace._id })
        .populate('contact')
        .populate('assignedAgent')
        .populate('notes.author', 'name avatar')
        .populate('activityLog.author', 'name');

      if (!deal) return res.status(404).json({ message: "Deal not found" });
      res.json({ success: true, data: deal });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create Deal
   */
  async createDeal(req: AuthRequest, res: Response) {
    try {
      const deal = await DealService.createDeal(req.workspace._id, req.body, req.user._id);
      res.status(201).json({ success: true, data: deal });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * Update Deal
   */
  async updateDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const deal = await Deal.findOneAndUpdate(
        { _id: id, workspace: req.workspace._id },
        { $set: req.body },
        { new: true }
      );
      res.json({ success: true, data: deal });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Update Deal Stage
   */
  async updateDealStage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { stageId } = req.body;
      const deal = await DealService.moveStage(req.workspace._id.toString(), id, stageId, req.user._id.toString());
      res.json({ success: true, data: deal });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * Add Deal Note
   */
  async addDealNote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "Note text is required" });

      const deal = await DealService.addNote(req.workspace._id.toString(), id, text, req.user._id.toString());
      res.json({ success: true, data: deal });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete Deal
   */
  async deleteDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await Deal.deleteOne({ _id: id, workspace: req.workspace._id });
      res.json({ success: true, message: "Deal deleted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * List Tasks
   */
  async getTasks(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const tasks = await Task.find({ workspace: workspace._id })
        .populate('relatedContact', 'name phone')
        .populate('relatedDeal', 'title')
        .sort({ dueDate: 1 });
      res.json({ success: true, data: tasks });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create Task
   */
  async createTask(req: AuthRequest, res: Response) {
    try {
      const task = await Task.create({
        ...req.body,
        workspace: req.workspace._id,
        createdBy: req.user._id
      });
      res.status(201).json({ success: true, data: task });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateTask(req: AuthRequest, res: Response) {
    try {
      const task = await Task.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { $set: req.body },
        { new: true }
      );
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
      res.json({ success: true, data: task });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateTaskStatus(req: AuthRequest, res: Response) {
    try {
      const update: any = { status: req.body.status };
      if (req.body.status === 'Completed') update.completedAt = new Date();

      const task = await Task.findOneAndUpdate(
        { _id: req.params.id, workspace: req.workspace._id },
        { $set: update },
        { new: true }
      );
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
      res.json({ success: true, data: task });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteTask(req: AuthRequest, res: Response) {
    try {
      const result = await Task.deleteOne({ _id: req.params.id, workspace: req.workspace._id });
      if (!result.deletedCount) return res.status(404).json({ success: false, message: "Task not found" });
      res.json({ success: true, message: "Task deleted" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * CRM Analytics
   */
  async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace._id;
      const ObjectId = mongoose.Types.ObjectId;
      const { pipelineId } = req.query;

      let pipeline;
      if (pipelineId) {
        pipeline = await Pipeline.findOne({ _id: pipelineId, workspace: workspaceId });
      } else {
        pipeline = await Pipeline.findOne({ workspace: workspaceId, isDefault: true }) || 
                   await Pipeline.findOne({ workspace: workspaceId });
      }

      if (!pipeline) {
        return res.status(404).json({ success: false, message: "No pipeline found" });
      }

      const deals = await Deal.find({ workspace: workspaceId, pipeline: pipeline._id });

      const funnelData = pipeline.stages.map((stage: any) => ({
        stage: stage.title,
        count: deals.filter(d => d.stage === stage.id).length,
        value: deals.filter(d => d.stage === stage.id).reduce((sum, d) => sum + (d.value || 0), 0)
      }));

      const statusData = [
        { name: 'Active', value: deals.filter(d => d.status === 'active').length, color: '#3B82F6' },
        { name: 'Won', value: deals.filter(d => d.status === 'won').length, color: '#10B981' },
        { name: 'Lost', value: deals.filter(d => d.status === 'lost').length, color: '#EF4444' },
        { name: 'Archived', value: deals.filter(d => d.status === 'archived').length, color: '#6B7280' }
      ];

      const agentPerformance = await Deal.aggregate([
        { $match: { workspace: new ObjectId(workspaceId), status: 'won' } },
        { $group: { 
            _id: "$assignedAgent", 
            count: { $sum: 1 }, 
            totalValue: { $sum: "$value" } 
        } },
        { $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "agent"
        } },
        { $unwind: "$agent" },
        { $project: {
            name: "$agent.name",
            count: 1,
            totalValue: 1
        } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const tasks = await Task.find({ workspace: workspaceId, status: { $ne: 'Completed' } });
      const now = new Date();
      const taskStats = {
        pending: tasks.length,
        overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length
      };

      const activeValue = deals.filter(d => d.status === 'active').reduce((sum, d) => sum + (d.value || 0), 0);
      const wonValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + (d.value || 0), 0);
      const winRate = deals.length > 0 ? (deals.filter(d => d.status === 'won').length / deals.length) * 100 : 0;

      res.json({
        success: true,
        data: {
          funnelData,
          statusData,
          agentPerformance,
          taskStats,
          metrics: {
            activeValue,
            wonValue,
            winRate: Math.round(winRate * 10) / 10,
            totalDeals: deals.length
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * CRM Automation Rules
   */
  async getAutomationRules(req: AuthRequest, res: Response) {
    try {
      const { pipelineId } = req.query;
      const response = await proxyController.forwardToService('automation', {
        method: 'GET',
        path: '/api/automation/engine/rules',
        params: { category: 'crm_rule' },
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });

      const rules = Array.isArray(response.data?.data?.rules) ? response.data.data.rules : [];
      const filteredRules = rules.filter((rule: any) => {
        if (rule?.trigger?.event !== 'crm_deal_stage_changed') return false;
        if (!pipelineId) return true;
        return rule?.trigger?.config?.pipelineId === pipelineId;
      });

      const transformedRules = filteredRules.map((rule: any) => ({
        id: rule._id,
        trigger: rule.trigger?.config?.stageId ? 'stage_entry' : rule.trigger?.event,
        action: rule.actions?.[0]?.type,
        config: rule.trigger?.config,
        isActive: rule.enabled
      }));

      res.json({ success: true, data: transformedRules });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Save CRM Automation Rule
   */
  async saveAutomationRule(req: AuthRequest, res: Response) {
    try {
      const { id, trigger, action, isActive, config } = req.body;

      const ruleData = {
        workspace: req.workspace._id,
        name: `CRM Automation: ${action} on ${trigger}`,
        category: 'crm_rule',
        enabled: isActive ?? true,
        trigger: {
          event: 'crm_deal_stage_changed',
          config: {
            pipelineId: config?.pipelineId,
            stageId: config?.stageId
          }
        },
        actions: [
          {
            type: action,
            config: config?.actionConfig || {},
            order: 0,
            continueOnFailure: true
          }
        ],
        updatedBy: req.user._id,
      };

      const requestConfig = {
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      };

      let response;
      if (id && id.length > 20) {
        response = await proxyController.forwardToService('automation', {
          method: 'PATCH',
          path: `/api/automation/engine/rules/${id}`,
          data: ruleData,
          ...requestConfig,
        });
      } else {
        response = await proxyController.forwardToService('automation', {
          method: 'POST',
          path: '/api/automation/engine/rules',
          data: {
            ...ruleData,
            createdBy: req.user._id
          },
          ...requestConfig,
        });
      }

      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete CRM Automation Rule
   */
  async deleteAutomationRule(req: AuthRequest, res: Response) {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: "ID is required" });
      const response = await proxyController.forwardToService('automation', {
        method: 'DELETE',
        path: `/api/automation/engine/rules/${id}`,
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
