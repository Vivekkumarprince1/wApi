import { Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth.js';
import { Deal, Pipeline, Task, Contact } from '../models/index.js';

// Setup Service URLs from environment
const CAMPAIGN_SERVICE_URL = process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002';
const AUTOMATION_SERVICE_URL = process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3001';

/**
 * Self-contained DealService Helper
 */
class DealService {
  static async createDeal(workspaceId: any, dealData: any, userId?: any) {
    const { contactId, pipelineId, title, value, currency, stage, assignedAgent, source = 'manual' } = dealData;

    // 1. Enforce "One active deal" constraint (Parity)
    const existing = await Deal.findOne({
      workspace: workspaceId,
      contact: contactId,
      status: 'active'
    });

    if (existing) {
      throw new Error('CONTACT_ALREADY_HAS_ACTIVE_DEAL');
    }

    // 2. Resolve Pipeline & Initial Stage
    const pipeline = await Pipeline.findOne({ _id: pipelineId, workspace: workspaceId });
    if (!pipeline) throw new Error('PIPELINE_NOT_FOUND');

    const initialStage = stage || pipeline.stages[0].id;

    // 3. Create Deal
    const deal = await Deal.create({
      workspace: workspaceId,
      contact: contactId,
      pipeline: pipelineId,
      title,
      value: value || 0,
      currency: currency || 'INR',
      stage: initialStage,
      assignedAgent,
      source,
      stageHistory: [{
        stage: initialStage,
        timestamp: new Date(),
        changedBy: userId
      }]
    });

    // 4. Sync to Contact
    await Contact.findByIdAndUpdate(contactId, {
      activeDealId: deal._id,
      activePipelineId: pipeline._id,
      assignedAgentId: assignedAgent
    });

    return deal;
  }

  static async moveStage(workspaceId: string, dealId: string, newStageId: string, userId?: string) {
    const deal = await Deal.findOne({ _id: dealId, workspace: workspaceId });
    if (!deal) throw new Error('DEAL_NOT_FOUND');

    const pipeline = await Pipeline.findById(deal.pipeline);
    if (!pipeline) throw new Error('PIPELINE_NOT_FOUND');

    const stageConfig = pipeline.stages.find((s: any) => s.id === newStageId);
    if (!stageConfig) throw new Error('INVALID_STAGE');

    // 1. Update Stage & History
    deal.stage = newStageId;
    deal.stageHistory.push({
      stage: newStageId,
      timestamp: new Date(),
      changedBy: userId as any
    });

    // 2. Handle Terminal Stages
    if (stageConfig.isFinal) {
      deal.status = (newStageId.toLowerCase() === 'won') ? 'won' : 'lost';
      deal.closedAt = new Date();

      // Clear active deal from contact
      await Contact.findByIdAndUpdate(deal.contact, {
        activeDealId: null,
        activePipelineId: null
      });
    } else {
      deal.status = 'active';
      deal.closedAt = null;

      // Re-sync active deal on contact
      await Contact.findByIdAndUpdate(deal.contact, {
        activeDealId: deal._id,
        activePipelineId: pipeline._id
      });
    }

    await deal.save();
    return deal;
  }

  static async addNote(workspaceId: string, dealId: string, text: string, userId: string) {
    return await Deal.findOneAndUpdate(
      { _id: dealId, workspace: workspaceId },
      { 
        $push: { 
          notes: { 
            text, 
            author: new mongoose.Types.ObjectId(userId), 
            createdAt: new Date() 
          } 
        } 
      },
      { new: true }
    );
  }
}

export const crmController = {
  /**
   * List Pipelines
   */
  async getPipelines(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      if (!workspaceId) {
        return res.status(400).json({ success: false, message: 'Workspace context missing' });
      }

      let pipelines = await Pipeline.find({ workspace: workspaceId }).sort({ createdAt: -1 });

      // Auto-create default pipeline if none exists
      if (pipelines.length === 0) {
        const defaultStages = [
          { id: 'leads', title: 'Leads', position: 0, color: '#6B7280' },
          { id: 'qualified', title: 'Qualified', position: 1, color: '#3B82F6' },
          { id: 'proposal', title: 'Proposal', position: 2, color: '#8B5CF6' },
          { id: 'won', title: 'Won', position: 3, isFinal: true, color: '#10B981' },
          { id: 'lost', title: 'Lost', position: 4, isFinal: true, color: '#EF4444' }
        ];

        const defaultPipeline = await Pipeline.create({
          workspace: workspaceId,
          name: 'Default Sales Pipeline',
          stages: defaultStages,
          isDefault: true
        });
        
        pipelines = [defaultPipeline];
      }

      return res.status(200).json({ success: true, data: pipelines });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create Pipeline
   */
  async createPipeline(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const { name, stages } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Pipeline name is required' });
      }

      const defaultStages = stages || [
        { id: 'leads', title: 'Leads', position: 0, color: '#6B7280' },
        { id: 'qualified', title: 'Qualified', position: 1, color: '#3B82F6' },
        { id: 'proposal', title: 'Proposal', position: 2, color: '#8B5CF6' },
        { id: 'won', title: 'Won', position: 3, isFinal: true, color: '#10B981' },
        { id: 'lost', title: 'Lost', position: 4, isFinal: true, color: '#EF4444' }
      ];

      const pipeline = await Pipeline.create({
        workspace: workspaceId,
        name,
        stages: defaultStages
      });

      return res.status(201).json({ success: true, data: pipeline });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * List Deals
   */
  async getDeals(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const { pipelineId, contactId, segmentId, stage, status = 'active', search } = req.query;
      const page = parseInt(req.query.page as string || "1", 10);
      const limit = parseInt(req.query.limit as string || "50", 10);
      
      const query: any = { workspace: workspaceId };
      if (pipelineId) query.pipeline = pipelineId;
      if (contactId) query.contact = contactId;
      if (stage) query.stage = stage;
      if (status && status !== 'all') query.status = status;

      // Handle Segment Filtering (Inter-service to campaign-service)
      if (segmentId && !contactId) {
        try {
          const campaignRes = await axios.get(`${CAMPAIGN_SERVICE_URL}/api/campaign/segments/${segmentId}/resolve`, {
            headers: {
              'x-workspace-id': String(workspaceId),
              'x-user-id': String(req.user?._id),
              'x-user-role': req.role || 'agent'
            }
          });
          
          const contactIds = campaignRes.data?.data || [];
          if (contactIds.length > 0) {
            query.contact = { $in: contactIds };
          } else {
            return res.json({ success: true, data: [], pagination: { total: 0, page, limit, pages: 0 } });
          }
        } catch (err: any) {
          console.error('[CRM:SegmentResolve] Inter-service failed:', err.message);
        }
      }

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

      return res.json({ 
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
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get Deals linked to Contact
   */
  async getContactDeals(req: AuthRequest, res: Response) {
    try {
      const { contactId } = req.params;
      const workspaceId = req.workspace?._id;
      const deals = await Deal.find({ workspace: workspaceId, contact: contactId })
        .populate('pipeline', 'name')
        .sort({ createdAt: -1 });

      return res.json({ success: true, data: deals });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get Deal Details
   */
  async getDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?._id;
      const deal = await Deal.findOne({ _id: id, workspace: workspaceId })
        .populate('contact')
        .populate('assignedAgent');

      if (!deal) return res.status(404).json({ message: "Deal not found" });
      return res.json({ success: true, data: deal });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create Deal
   */
  async createDeal(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const userId = req.user?._id;
      const deal = await DealService.createDeal(workspaceId, req.body, userId);
      return res.status(201).json({ success: true, data: deal });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * Update Deal
   */
  async updateDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?._id;
      const deal = await Deal.findOneAndUpdate(
        { _id: id, workspace: workspaceId },
        { $set: req.body },
        { new: true }
      );
      if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });
      return res.json({ success: true, data: deal });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Update Deal Stage
   */
  async updateDealStage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { stageId } = req.body;
      const workspaceId = req.workspace?._id;
      const userId = req.user?._id;
      
      const deal = await DealService.moveStage(String(workspaceId), id, stageId, String(userId));
      return res.json({ success: true, data: deal });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * Add Deal Note
   */
  async addDealNote(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const workspaceId = req.workspace?._id;
      const userId = req.user?._id;

      if (!text) return res.status(400).json({ message: "Note text is required" });

      const deal = await DealService.addNote(String(workspaceId), id, text, String(userId));
      return res.json({ success: true, data: deal });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete Deal
   */
  async deleteDeal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?._id;
      
      await Deal.deleteOne({ _id: id, workspace: workspaceId });
      
      // Cleanup from Contact
      await Contact.findOneAndUpdate(
        { activeDealId: id },
        { activeDealId: null, activePipelineId: null }
      );

      return res.json({ success: true, message: "Deal deleted" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * List Tasks
   */
  async getTasks(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const tasks = await Task.find({ workspace: workspaceId })
        .populate('relatedContact', 'name phone')
        .populate('relatedDeal', 'title')
        .sort({ dueDate: 1 });
      return res.json({ success: true, data: tasks });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create Task
   */
  async createTask(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const userId = req.user?._id;
      const task = await Task.create({
        ...req.body,
        workspace: workspaceId,
        assignee: req.body.assignee || userId
      });
      return res.status(201).json({ success: true, data: task });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Update Task
   */
  async updateTask(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const task = await Task.findOneAndUpdate(
        { _id: req.params.id, workspace: workspaceId },
        { $set: req.body },
        { new: true }
      );
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
      return res.json({ success: true, data: task });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Update Task Status
   */
  async updateTaskStatus(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const update: any = { status: req.body.status };
      if (req.body.status === 'Completed') {
        update.completedAt = new Date();
      }

      const task = await Task.findOneAndUpdate(
        { _id: req.params.id, workspace: workspaceId },
        { $set: update },
        { new: true }
      );
      if (!task) return res.status(404).json({ success: false, message: "Task not found" });
      return res.json({ success: true, data: task });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete Task
   */
  async deleteTask(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const result = await Task.deleteOne({ _id: req.params.id, workspace: workspaceId });
      if (!result.deletedCount) return res.status(404).json({ success: false, message: "Task not found" });
      return res.json({ success: true, message: "Task deleted" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * CRM Analytics
   */
  async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
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

      // Safe aggregate for agent performance
      const agentPerformance = await Deal.aggregate([
        { $match: { workspace: new mongoose.Types.ObjectId(String(workspaceId)), status: 'won' } },
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
        { $unwind: { path: "$agent", preserveNullAndEmptyArrays: true } },
        { $project: {
            name: { $ifNull: ["$agent.name", "Unassigned"] },
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

      return res.json({
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
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * CRM Automation Rules (Proxy to automation-service)
   */
  async getAutomationRules(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const { pipelineId } = req.query;

      const response = await axios.get(`${AUTOMATION_SERVICE_URL}/api/automation/engine/rules`, {
        params: { category: 'crm_rule' },
        headers: {
          'x-workspace-id': String(workspaceId),
          'x-user-id': String(req.user?._id),
          'x-user-role': req.role || 'agent'
        }
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

      return res.json({ success: true, data: transformedRules });
    } catch (err: any) {
      // In case automation-service isn't running or error, return empty list instead of crashing
      console.warn('[CRM:AutomationRules] Failed to fetch from automation-service:', err.message);
      return res.json({ success: true, data: [] });
    }
  },

  /**
   * Save CRM Automation Rule (Proxy to automation-service)
   */
  async saveAutomationRule(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const userId = req.user?._id;
      const { id, trigger, action, isActive, config } = req.body;

      const ruleData = {
        workspace: workspaceId,
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
        updatedBy: userId,
      };

      const headers = {
        'x-workspace-id': String(workspaceId),
        'x-user-id': String(userId),
        'x-user-role': req.role || 'agent'
      };

      let response;
      if (id && id.length > 20) {
        response = await axios.patch(`${AUTOMATION_SERVICE_URL}/api/automation/engine/rules/${id}`, ruleData, { headers });
      } else {
        response = await axios.post(`${AUTOMATION_SERVICE_URL}/api/automation/engine/rules`, {
          ...ruleData,
          createdBy: userId
        }, { headers });
      }

      return res.status(response.status).json(response.data);
    } catch (err: any) {
      console.error('[CRM:SaveAutomationRule] Failed:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete CRM Automation Rule (Proxy to automation-service)
   */
  async deleteAutomationRule(req: AuthRequest, res: Response) {
    try {
      const workspaceId = req.workspace?._id;
      const userId = req.user?._id;
      const { id } = req.query;

      if (!id) return res.status(400).json({ message: "ID is required" });

      const response = await axios.delete(`${AUTOMATION_SERVICE_URL}/api/automation/engine/rules/${id}`, {
        headers: {
          'x-workspace-id': String(workspaceId),
          'x-user-id': String(userId),
          'x-user-role': req.role || 'agent'
        }
      });
      return res.status(response.status).json(response.data);
    } catch (err: any) {
      console.error('[CRM:DeleteAutomationRule] Failed:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};
