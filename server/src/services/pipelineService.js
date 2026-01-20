/**
 * Pipeline & Deals Service - Stage 5 CRM
 * 
 * Manages sales pipelines and deals:
 * - Pipeline CRUD with customizable stages
 * - Deal lifecycle management
 * - Stage change tracking
 * - Pipeline analytics
 */

const mongoose = require('mongoose');
const Pipeline = require('../models/Pipeline');
const Deal = require('../models/Deal');
const Contact = require('../models/Contact');
const { logger } = require('../utils/logger');

// Default pipeline stages (Interakt-style)
const DEFAULT_STAGES = [
  { id: 'new', title: 'New', position: 0, isFinal: false, color: '#6366F1' },
  { id: 'contacted', title: 'Contacted', position: 1, isFinal: false, color: '#8B5CF6' },
  { id: 'qualified', title: 'Qualified', position: 2, isFinal: false, color: '#EC4899' },
  { id: 'proposal', title: 'Proposal Sent', position: 3, isFinal: false, color: '#F59E0B' },
  { id: 'negotiation', title: 'Negotiation', position: 4, isFinal: false, color: '#10B981' },
  { id: 'won', title: 'Won', position: 5, isFinal: true, color: '#22C55E' },
  { id: 'lost', title: 'Lost', position: 6, isFinal: true, color: '#EF4444' }
];

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new pipeline
 */
async function createPipeline(workspaceId, pipelineData, userId = null) {
  try {
    const { name, description, stages, isDefault } = pipelineData;
    
    // If this is the first pipeline, make it default
    const existingCount = await Pipeline.countDocuments({ workspace: workspaceId });
    const shouldBeDefault = isDefault || existingCount === 0;
    
    // If making this default, unset other defaults
    if (shouldBeDefault) {
      await Pipeline.updateMany(
        { workspace: workspaceId },
        { isDefault: false }
      );
    }
    
    const pipeline = await Pipeline.create({
      workspace: workspaceId,
      name,
      description,
      stages: stages || DEFAULT_STAGES,
      isDefault: shouldBeDefault
    });
    
    logger.info(`[Pipeline] Created pipeline "${name}" for workspace ${workspaceId}`);
    return pipeline;
    
  } catch (error) {
    logger.error('[Pipeline] Failed to create pipeline:', error);
    throw error;
  }
}

/**
 * Get or create default pipeline for workspace
 */
async function getOrCreateDefaultPipeline(workspaceId) {
  try {
    let pipeline = await Pipeline.findOne({ 
      workspace: workspaceId, 
      isDefault: true 
    });
    
    if (!pipeline) {
      pipeline = await createPipeline(workspaceId, {
        name: 'Sales Pipeline',
        description: 'Default sales pipeline',
        stages: DEFAULT_STAGES,
        isDefault: true
      });
    }
    
    return pipeline;
    
  } catch (error) {
    logger.error('[Pipeline] Failed to get/create default pipeline:', error);
    throw error;
  }
}

/**
 * Update pipeline
 */
async function updatePipeline(workspaceId, pipelineId, updates) {
  try {
    const allowedUpdates = ['name', 'description', 'stages', 'isDefault'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });
    
    // If making this default, unset other defaults
    if (updateData.isDefault) {
      await Pipeline.updateMany(
        { workspace: workspaceId, _id: { $ne: pipelineId } },
        { isDefault: false }
      );
    }
    
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, workspace: workspaceId },
      updateData,
      { new: true }
    );
    
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }
    
    logger.info(`[Pipeline] Updated pipeline ${pipelineId}`);
    return pipeline;
    
  } catch (error) {
    logger.error('[Pipeline] Failed to update pipeline:', error);
    throw error;
  }
}

/**
 * Delete pipeline (only if no deals exist)
 */
async function deletePipeline(workspaceId, pipelineId) {
  try {
    // Check for existing deals
    const dealCount = await Deal.countDocuments({ pipeline: pipelineId });
    
    if (dealCount > 0) {
      throw new Error(`Cannot delete pipeline with ${dealCount} existing deals`);
    }
    
    const pipeline = await Pipeline.findOneAndDelete({
      _id: pipelineId,
      workspace: workspaceId
    });
    
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }
    
    logger.info(`[Pipeline] Deleted pipeline ${pipelineId}`);
    return { success: true };
    
  } catch (error) {
    logger.error('[Pipeline] Failed to delete pipeline:', error);
    throw error;
  }
}

/**
 * Get all pipelines for workspace
 */
async function getPipelines(workspaceId) {
  try {
    const pipelines = await Pipeline.find({ workspace: workspaceId })
      .sort({ isDefault: -1, createdAt: 1 })
      .lean();
    
    // Add deal counts per stage
    const enrichedPipelines = await Promise.all(
      pipelines.map(async (pipeline) => {
        const stageCounts = await Deal.aggregate([
          { $match: { pipeline: pipeline._id, status: 'active' } },
          { $group: { _id: '$stage', count: { $sum: 1 }, totalValue: { $sum: '$value' } } }
        ]);
        
        const stageMap = stageCounts.reduce((acc, s) => {
          acc[s._id] = { count: s.count, totalValue: s.totalValue };
          return acc;
        }, {});
        
        return {
          ...pipeline,
          stages: pipeline.stages.map(stage => ({
            ...stage,
            dealCount: stageMap[stage.id]?.count || 0,
            totalValue: stageMap[stage.id]?.totalValue || 0
          }))
        };
      })
    );
    
    return enrichedPipelines;
    
  } catch (error) {
    logger.error('[Pipeline] Failed to get pipelines:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEAL CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new deal
 */
async function createDeal(workspaceId, dealData, userId = null) {
  try {
    const { contactId, pipelineId, title, description, value, currency, stage, assignedAgent } = dealData;
    
    // Get pipeline (use default if not specified)
    let pipeline;
    if (pipelineId) {
      pipeline = await Pipeline.findOne({ _id: pipelineId, workspace: workspaceId });
    } else {
      pipeline = await getOrCreateDefaultPipeline(workspaceId);
    }
    
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }
    
    // Validate stage exists in pipeline
    const initialStage = stage || pipeline.stages[0].id;
    const stageExists = pipeline.stages.some(s => s.id === initialStage);
    
    if (!stageExists) {
      throw new Error('Invalid stage for this pipeline');
    }
    
    // Check for existing active deal for this contact
    const existingDeal = await Deal.findOne({
      workspace: workspaceId,
      contact: contactId,
      status: 'active'
    });
    
    if (existingDeal) {
      throw new Error('Contact already has an active deal');
    }
    
    const deal = await Deal.create({
      workspace: workspaceId,
      contact: contactId,
      pipeline: pipeline._id,
      title,
      description,
      value: value || 0,
      currency: currency || 'USD',
      stage: initialStage,
      assignedAgent,
      stageHistory: [{
        stage: initialStage,
        timestamp: new Date(),
        changedBy: userId
      }]
    });
    
    // Update contact with deal reference
    await Contact.findByIdAndUpdate(contactId, {
      activeDealId: deal._id,
      activePipelineId: pipeline._id,
      assignedAgentId: assignedAgent
    });
    
    logger.info(`[Deal] Created deal "${title}" for contact ${contactId}`);
    return deal;
    
  } catch (error) {
    logger.error('[Deal] Failed to create deal:', error);
    throw error;
  }
}

/**
 * Update deal
 */
async function updateDeal(workspaceId, dealId, updates, userId = null) {
  try {
    const deal = await Deal.findOne({ _id: dealId, workspace: workspaceId });
    
    if (!deal) {
      throw new Error('Deal not found');
    }
    
    const allowedUpdates = ['title', 'description', 'value', 'currency', 'assignedAgent'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        deal[field] = updates[field];
      }
    });
    
    await deal.save();
    
    // Update contact if agent changed
    if (updates.assignedAgent) {
      await Contact.findByIdAndUpdate(deal.contact, {
        assignedAgentId: updates.assignedAgent
      });
    }
    
    logger.info(`[Deal] Updated deal ${dealId}`);
    return deal;
    
  } catch (error) {
    logger.error('[Deal] Failed to update deal:', error);
    throw error;
  }
}

/**
 * Move deal to a different stage
 */
async function moveDealToStage(workspaceId, dealId, newStage, userId = null) {
  try {
    const deal = await Deal.findOne({ _id: dealId, workspace: workspaceId })
      .populate('pipeline');
    
    if (!deal) {
      throw new Error('Deal not found');
    }
    
    // Validate new stage
    const stageConfig = deal.pipeline.stages.find(s => s.id === newStage);
    
    if (!stageConfig) {
      throw new Error('Invalid stage for this pipeline');
    }
    
    // Record stage change
    deal.stage = newStage;
    deal.stageHistory.push({
      stage: newStage,
      timestamp: new Date(),
      changedBy: userId
    });
    
    // If moving to final stage, update status
    if (stageConfig.isFinal) {
      deal.status = newStage === 'won' ? 'won' : 'lost';
      deal.closedAt = new Date();
      
      // Clear active deal from contact
      await Contact.findByIdAndUpdate(deal.contact, {
        activeDealId: null,
        activePipelineId: null
      });
    }
    
    await deal.save();
    
    logger.info(`[Deal] Moved deal ${dealId} to stage "${newStage}"`);
    return deal;
    
  } catch (error) {
    logger.error('[Deal] Failed to move deal:', error);
    throw error;
  }
}

/**
 * Add note to deal
 */
async function addDealNote(workspaceId, dealId, noteText, userId) {
  try {
    const deal = await Deal.findOneAndUpdate(
      { _id: dealId, workspace: workspaceId },
      {
        $push: {
          notes: {
            text: noteText,
            author: userId,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    ).populate('notes.author', 'name email');
    
    if (!deal) {
      throw new Error('Deal not found');
    }
    
    logger.info(`[Deal] Added note to deal ${dealId}`);
    return deal;
    
  } catch (error) {
    logger.error('[Deal] Failed to add note:', error);
    throw error;
  }
}

/**
 * Get deals for a pipeline with Kanban structure
 */
async function getDealsForPipeline(workspaceId, pipelineId, options = {}) {
  const { assignedTo, status = 'active' } = options;
  
  try {
    const pipeline = await Pipeline.findOne({ 
      _id: pipelineId, 
      workspace: workspaceId 
    }).lean();
    
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }
    
    const query = {
      workspace: workspaceId,
      pipeline: pipelineId
    };
    
    if (status !== 'all') {
      query.status = status;
    }
    
    if (assignedTo) {
      query.assignedAgent = assignedTo;
    }
    
    const deals = await Deal.find(query)
      .populate('contact', 'name phone')
      .populate('assignedAgent', 'name email')
      .sort({ updatedAt: -1 })
      .lean();
    
    // Group by stage (Kanban format)
    const kanban = {};
    pipeline.stages.forEach(stage => {
      kanban[stage.id] = {
        ...stage,
        deals: []
      };
    });
    
    deals.forEach(deal => {
      if (kanban[deal.stage]) {
        kanban[deal.stage].deals.push(deal);
      }
    });
    
    return {
      pipeline,
      stages: Object.values(kanban)
    };
    
  } catch (error) {
    logger.error('[Deal] Failed to get deals for pipeline:', error);
    throw error;
  }
}

/**
 * Get deal by ID with full details
 */
async function getDealById(workspaceId, dealId) {
  try {
    const deal = await Deal.findOne({ _id: dealId, workspace: workspaceId })
      .populate('contact', 'name phone tags metadata')
      .populate('pipeline', 'name stages')
      .populate('assignedAgent', 'name email')
      .populate('notes.author', 'name email')
      .populate('stageHistory.changedBy', 'name email')
      .lean();
    
    if (!deal) {
      throw new Error('Deal not found');
    }
    
    return deal;
    
  } catch (error) {
    logger.error('[Deal] Failed to get deal:', error);
    throw error;
  }
}

/**
 * Get deal for a contact
 */
async function getDealForContact(workspaceId, contactId) {
  try {
    const deal = await Deal.findOne({
      workspace: workspaceId,
      contact: contactId,
      status: 'active'
    })
      .populate('pipeline', 'name stages')
      .populate('assignedAgent', 'name email')
      .lean();
    
    return deal;
    
  } catch (error) {
    logger.error('[Deal] Failed to get deal for contact:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get pipeline analytics
 */
async function getPipelineAnalytics(workspaceId, pipelineId, startDate, endDate) {
  const ObjectId = mongoose.Types.ObjectId;
  
  try {
    // Deals created in period
    const dealsCreated = await Deal.countDocuments({
      pipeline: pipelineId,
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Deals won
    const dealsWon = await Deal.countDocuments({
      pipeline: pipelineId,
      status: 'won',
      closedAt: { $gte: startDate, $lte: endDate }
    });
    
    // Deals lost
    const dealsLost = await Deal.countDocuments({
      pipeline: pipelineId,
      status: 'lost',
      closedAt: { $gte: startDate, $lte: endDate }
    });
    
    // Total value won
    const valueWon = await Deal.aggregate([
      {
        $match: {
          pipeline: new ObjectId(pipelineId),
          status: 'won',
          closedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$value' }
        }
      }
    ]);
    
    // Conversion funnel
    const stageCounts = await Deal.aggregate([
      {
        $match: {
          pipeline: new ObjectId(pipelineId),
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$stageHistory' },
      {
        $group: {
          _id: '$stageHistory.stage',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Average deal cycle time
    const cycleTimeAgg = await Deal.aggregate([
      {
        $match: {
          pipeline: new ObjectId(pipelineId),
          status: { $in: ['won', 'lost'] },
          closedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          cycleTime: {
            $divide: [
              { $subtract: ['$closedAt', '$createdAt'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgCycleTime: { $avg: '$cycleTime' }
        }
      }
    ]);
    
    return {
      period: { startDate, endDate },
      deals: {
        created: dealsCreated,
        won: dealsWon,
        lost: dealsLost,
        active: await Deal.countDocuments({ pipeline: pipelineId, status: 'active' })
      },
      value: {
        won: valueWon[0]?.total || 0,
        pipeline: await Deal.aggregate([
          { $match: { pipeline: new ObjectId(pipelineId), status: 'active' } },
          { $group: { _id: null, total: { $sum: '$value' } } }
        ]).then(r => r[0]?.total || 0)
      },
      conversion: {
        winRate: dealsWon + dealsLost > 0 
          ? Math.round((dealsWon / (dealsWon + dealsLost)) * 100) 
          : 0,
        avgCycleTimeDays: Math.round(cycleTimeAgg[0]?.avgCycleTime || 0)
      },
      funnel: stageCounts.map(s => ({ stage: s._id, count: s.count }))
    };
    
  } catch (error) {
    logger.error('[Pipeline] Failed to get analytics:', error);
    throw error;
  }
}

module.exports = {
  // Pipeline CRUD
  createPipeline,
  getOrCreateDefaultPipeline,
  updatePipeline,
  deletePipeline,
  getPipelines,
  
  // Deal CRUD
  createDeal,
  updateDeal,
  moveDealToStage,
  addDealNote,
  getDealsForPipeline,
  getDealById,
  getDealForContact,
  
  // Analytics
  getPipelineAnalytics,
  
  // Constants
  DEFAULT_STAGES
};
