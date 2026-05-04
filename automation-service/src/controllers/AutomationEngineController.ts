import { Request, Response } from 'express';
import { Model } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { 
  AutomationRule, 
  AutomationExecution, 
  AutoReply, 
  AutoReplyLog, 
  AutomationAuditLog, 
  AnswerBotSource, 
  AnswerBotSettings, 
  WorkflowExecution, 
  AiIntentMatchLog, 
  InteraktiveList,
  FAQ,
  InstagramQuickflow,
  InstagramQuickflowLog
} from '../models';
import { sendInternalAction } from '../lib/internal-client';
import { FlowExecutorService } from '../services/flow-executor';
import { AutomationService } from '../services/automation-service';

export const getRules = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    if (!workspaceId) return res.status(400).json({ success: false, error: 'Workspace ID missing' });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    const category = req.query.category;
    const rulesQuery: any = { 
      workspace: workspaceId, 
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
      ]
    };

    if (category) {
      rulesQuery.category = category;
    }
    
    let rules = await AutomationRule.find(rulesQuery).sort({ priority: -1, createdAt: -1 }).lean();
    
    // Fallback: If 0 rules, try converting to ObjectId just in case Mongoose didn't auto-cast
    if (rules.length === 0 && workspaceId.length === 24) {
      const { Types } = await import('mongoose');
      const workspaceFilter = { $in: [workspaceId, new Types.ObjectId(workspaceId)] };
      const fallbackQuery: any = { 
        workspace: workspaceFilter,
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } }
        ]
      };
      if (category) {
        fallbackQuery.category = category;
      }
      rules = await AutomationRule.find(fallbackQuery).sort({ priority: -1, createdAt: -1 }).lean();
    }

    console.log(`[Debug] getRules - Found ${rules.length} rules.`);
    res.json({ success: true, data: rules });
  } catch (error: any) {
    console.error(`[Debug] getRules - Error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRuleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    if (!id || !workspaceId) return res.status(400).json({ success: false, error: 'ID or Workspace missing' });

    const rule = await AutomationRule.findOne({ _id: id, workspace: workspaceId }).lean();
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createRule = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.create({ ...req.body, workspace: workspaceId });
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.findOne({ _id: id, workspace: workspaceId });
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });

    rule.enabled = !rule.enabled;
    await rule.save();

    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      { $set: { deletedAt: new Date(), enabled: false } },
      { returnDocument: 'after' }
    );
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, message: 'Rule deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const days = parseInt(req.query.days as string || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalExecutions, successCount, failedCount, activeRules] = await Promise.all([
      AutomationExecution.countDocuments({ workspace: workspaceId, createdAt: { $gte: startDate } }),
      AutomationExecution.countDocuments({ workspace: workspaceId, status: 'SUCCESS', createdAt: { $gte: startDate } }),
      AutomationExecution.countDocuments({ workspace: workspaceId, status: 'FAILED', createdAt: { $gte: startDate } }),
      AutomationRule.countDocuments({ 
        workspace: workspaceId, 
        enabled: true, 
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } }
        ] 
      })
    ]);

    res.json({
      success: true,
      data: {
        totalExecutions,
        successCount,
        failedCount,
        activeRules,
        successRate: totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getExecutionLogs = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const logs = await AutomationExecution.find({ workspace: workspaceId }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const handleInboundTrigger = async (req: Request, res: Response) => {
  try {
    const handled = await AutomationService.handleInboundMessage(req.body);
    res.json({ success: true, handled });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const handleEventTrigger = async (req: Request, res: Response) => {
  try {
    const { workspaceId, event, data } = req.body;
    const rules = await AutomationRule.find({ workspace: workspaceId, enabled: true, 'trigger.event': event }).lean();
    for (const rule of rules) {
      FlowExecutorService.execute(rule._id.toString(), { ...data, eventType: event, workspaceId }).catch(() => {});
    }
    res.json({ success: true, rulesCount: rules.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAutomationHubSummary = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    if (!workspaceId) return res.status(400).json({ success: false, error: 'Workspace ID missing' });

    // Prevent caching of summary data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const days = parseInt(req.query.days as string || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { Types } = await import('mongoose');
    const workspaceFilter = workspaceId.length === 24 
      ? { $in: [workspaceId, new Types.ObjectId(workspaceId)] }
      : workspaceId;

    const baseQuery: any = {
      workspace: workspaceFilter,
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
      ]
    };

    console.log(`[Debug] getAutomationHubSummary - workspaceId: ${workspaceId}, using filter:`, workspaceFilter);

    // Parallel execution for all module data
    const [
      rules,
      answerBotSettings,
      answerBotSourcesCount,
      answerBotDraftFaqsCount,
      interaktiveLists,
      quickflows,
      totalExecutions,
      successCount,
      failedCount
    ] = await Promise.all([
      AutomationRule.find(baseQuery).lean(),
      AnswerBotSettings.findOne({ workspace: workspaceFilter }).lean(),
      AnswerBotSource.countDocuments({ workspace: workspaceFilter }),
      FAQ.countDocuments({ ...baseQuery, status: 'draft' }),
      InteraktiveList.find(baseQuery).lean(),
      InstagramQuickflow.find({ workspace: workspaceFilter }).lean(), // No deletedAt for IG
      AutomationExecution.countDocuments({ workspace: workspaceFilter, createdAt: { $gte: startDate } }),
      AutomationExecution.countDocuments({ workspace: workspaceFilter, status: 'SUCCESS', createdAt: { $gte: startDate } }),
      AutomationExecution.countDocuments({ workspace: workspaceFilter, status: 'FAILED', createdAt: { $gte: startDate } }),
    ]);

    console.log(`[Debug] getAutomationHubSummary - Results:`, {
      rulesCount: rules.length,
      listsCount: interaktiveLists.length,
      quickflowsCount: quickflows.length,
      faqsCount: answerBotDraftFaqsCount
    });

    // Memory processing (faster than multiple DB queries for small counts)
    console.log(`[Debug] Rule categories:`, rules.map(r => r.category));
    const workflowsCount = rules.filter(r => r.category === 'workflow').length;
    const autoRepliesCount = rules.filter(r => r.category === 'auto_reply').length;
    const activeRulesCount = rules.filter(r => r.enabled).length;
    const aiIntentsCount = rules.filter(r => r.trigger?.type === 'ai_intent').length;

    const enabledInteraktiveCount = interaktiveLists.filter((l: any) => l.enabled).length;
    const enabledQuickflowsCount = quickflows.filter((f: any) => f.enabled).length;

    res.json({
      success: true,
      data: {
        workflowsCount,
        autoRepliesCount,
        activeRulesCount,
        aiIntentsCount,
        answerBot: {
          enabled: !!answerBotSettings?.enabled,
          sourcesCount: answerBotSourcesCount,
          draftFaqsCount: answerBotDraftFaqsCount
        },
        interaktive: {
          total: interaktiveLists.length,
          enabled: enabledInteraktiveCount
        },
        quickflows: {
          total: quickflows.length,
          enabled: enabledQuickflowsCount
        },
        executionOverview: {
          total: totalExecutions,
          success: successCount,
          failed: failedCount,
          skipped: totalExecutions - (successCount + failedCount)
        },
        successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0
      }
    });
  } catch (error: any) {
    console.error(`[AutomationEngineController] Summary Error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const purgeWorkspaceData = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) return res.status(400).json({ success: false, error: 'Workspace ID required' });
    const models: Model<any>[] = [
      AutomationRule, AutomationExecution, AutoReply, AutoReplyLog, AutomationAuditLog, 
      AnswerBotSource, AnswerBotSettings, WorkflowExecution, AiIntentMatchLog, 
      InteraktiveList, FAQ, InstagramQuickflow, InstagramQuickflowLog
    ];
    await Promise.all(models.map(model => model.deleteMany({ workspace: workspaceId })));
    res.json({ success: true, message: 'Purge complete' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
