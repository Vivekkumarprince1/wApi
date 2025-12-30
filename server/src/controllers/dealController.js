const Deal = require('../models/Deal');
const Pipeline = require('../models/Pipeline');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');

/**
 * Create a new deal for a contact in a pipeline
 * This adds the contact to a sales pipeline
 */
async function createDeal(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contactId, pipelineId, title, description, value, currency } = req.body;

    // Check plan limits
    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc) return res.status(404).json({ message: 'Workspace not found' });
    
    const maxActiveDeals = workspaceDoc.planLimits?.maxActiveDeals || 50;
    const currentActiveDealCount = await Deal.countDocuments({ 
      workspace,
      status: 'active'
    });
    
    if (currentActiveDealCount >= maxActiveDeals) {
      return res.status(403).json({ 
        message: `Active deal limit reached for your plan`,
        current: currentActiveDealCount,
        limit: maxActiveDeals,
        upgrade: true
      });
    }

    // Validate contact exists in workspace
    const contact = await Contact.findOne({ _id: contactId, workspace });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    // Validate pipeline exists and get default stage
    const pipeline = await Pipeline.findOne({ _id: pipelineId, workspace });
    if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });

    // Get first stage (leads/entry stage)
    const firstStage = pipeline.stages.sort((a, b) => a.position - b.position)[0];
    if (!firstStage) return res.status(400).json({ message: 'Pipeline has no stages configured' });

    // Check if contact already has active deal in this workspace
    const existingDeal = await Deal.findOne({ 
      workspace, 
      contact: contactId,
      status: 'active'
    });
    if (existingDeal) {
      return res.status(400).json({ message: 'Contact already has an active deal' });
    }

    // Create deal
    const deal = await Deal.create({
      workspace,
      contact: contactId,
      pipeline: pipelineId,
      title: title || `${contact.name || contact.phone}`,
      description,
      value: value || 0,
      currency: currency || 'USD',
      stage: firstStage.id,
      assignedAgent: req.user._id
    });

    // Record first stage transition in history
    deal.stageHistory.push({
      stage: firstStage.id,
      changedBy: req.user._id
    });
    await deal.save();

    // Update contact with active deal reference
    contact.activeDealId = deal._id;
    contact.activePipelineId = pipelineId;
    contact.assignedAgentId = req.user._id;
    await contact.save();

    // Populate deal with references
    await deal.populate(['contact', 'pipeline', 'assignedAgent']);

    res.status(201).json({ success: true, deal });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all deals for a workspace with optional filtering
 */
async function listDeals(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { 
      page = 1, 
      limit = 50, 
      stage, 
      pipelineId, 
      status = 'active',
      assignedAgent,
      search 
    } = req.query;

    const query = { workspace };
    
    if (stage) query.stage = stage;
    if (pipelineId) query.pipeline = pipelineId;
    if (status) query.status = status;
    if (assignedAgent) query.assignedAgent = assignedAgent;
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
        { 'contact.name': { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Deal.countDocuments(query);
    const deals = await Deal.find(query)
      .populate('contact', 'name phone')
      .populate('pipeline', 'name')
      .populate('assignedAgent', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({
      deals,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single deal
 */
async function getDeal(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const deal = await Deal.findOne({ _id: req.params.id, workspace })
      .populate('contact')
      .populate('pipeline')
      .populate('assignedAgent', 'name email')
      .populate('notes.author', 'name email');
    
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    res.json(deal);
  } catch (err) {
    next(err);
  }
}

/**
 * Move deal to a different stage
 */
async function moveStage(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { stageId } = req.body;

    const deal = await Deal.findOne({ _id: req.params.id, workspace });
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    // Validate stage exists in pipeline
    const pipeline = await Pipeline.findById(deal.pipeline);
    const validStage = pipeline.stages.find(s => s.id === stageId);
    if (!validStage) return res.status(400).json({ message: 'Invalid stage' });

    // Update stage
    const oldStage = deal.stage;
    deal.stage = stageId;

    // Add to history
    deal.stageHistory.push({
      stage: stageId,
      changedBy: req.user._id
    });

    // If moving to final stage (won/lost), set closedAt
    if (validStage.isFinal && !deal.closedAt) {
      deal.closedAt = new Date();
      // Determine status based on stage
      if (stageId === 'won') deal.status = 'won';
      else if (stageId === 'lost') deal.status = 'lost';
    }

    await deal.save();

    // Clear active deal reference if moved to terminal stage
    if (validStage.isFinal) {
      await Contact.updateOne(
        { _id: deal.contact },
        { activeDealId: null, activePipelineId: null }
      );
    }

    res.json({ success: true, deal });
  } catch (err) {
    next(err);
  }
}

/**
 * Update deal details (title, description, value, assignee)
 */
async function updateDeal(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { title, description, value, currency, assignedAgent } = req.body;

    const deal = await Deal.findOne({ _id: req.params.id, workspace });
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    if (title) deal.title = title;
    if (description) deal.description = description;
    if (value !== undefined) deal.value = value;
    if (currency) deal.currency = currency;
    if (assignedAgent) deal.assignedAgent = assignedAgent;

    await deal.save();

    await deal.populate(['contact', 'pipeline', 'assignedAgent']);
    res.json({ success: true, deal });
  } catch (err) {
    next(err);
  }
}

/**
 * Add note to deal
 */
async function addNote(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Note text is required' });
    }

    const deal = await Deal.findOne({ _id: req.params.id, workspace });
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    deal.notes.push({
      text: text.trim(),
      author: req.user._id,
      createdAt: new Date()
    });

    await deal.save();

    await deal.populate('notes.author', 'name email');
    res.json({ success: true, deal });
  } catch (err) {
    next(err);
  }
}

/**
 * Get deals by contact
 */
async function getDealsByContact(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contactId } = req.params;

    const deals = await Deal.find({ workspace, contact: contactId })
      .populate('pipeline', 'name')
      .populate('assignedAgent', 'name email')
      .sort({ createdAt: -1 });

    res.json({ deals });
  } catch (err) {
    next(err);
  }
}

/**
 * Get deals by stage (for pipeline view)
 */
async function getDealsByStage(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { pipelineId } = req.params;

    const pipeline = await Pipeline.findOne({ _id: pipelineId, workspace });
    if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });

    // Get all deals grouped by stage
    const dealsPerStage = {};
    
    for (const stageObj of pipeline.stages) {
      const deals = await Deal.find({
        workspace,
        pipeline: pipelineId,
        stage: stageObj.id,
        status: { $in: ['active', 'won', 'lost'] }
      })
        .populate('contact', 'name phone')
        .populate('assignedAgent', 'name email')
        .sort({ createdAt: -1 });

      dealsPerStage[stageObj.id] = deals;
    }

    res.json({ pipeline, deals: dealsPerStage });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete deal
 */
async function deleteDeal(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const deal = await Deal.findOne({ _id: req.params.id, workspace });
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    // Clear reference from contact
    await Contact.updateOne(
      { _id: deal.contact },
      { activeDealId: null, activePipelineId: null }
    );

    await Deal.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDeal,
  listDeals,
  getDeal,
  moveStage,
  updateDeal,
  addNote,
  getDealsByContact,
  getDealsByStage,
  deleteDeal
};
