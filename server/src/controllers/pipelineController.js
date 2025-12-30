const Pipeline = require('../models/Pipeline');
const Deal = require('../models/Deal');

/**
 * Create a new pipeline for workspace
 */
async function createPipeline(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { name, description, stages, isDefault } = req.body;

    // Check plan limits
    const workspaceDoc = await require('../models/Workspace').findById(workspace);
    if (!workspaceDoc) return res.status(404).json({ message: 'Workspace not found' });
    
    const maxPipelines = workspaceDoc.planLimits?.maxPipelines || 5;
    const currentPipelineCount = await Pipeline.countDocuments({ workspace });
    
    if (currentPipelineCount >= maxPipelines) {
      return res.status(403).json({ 
        message: `Pipeline limit reached for your plan`,
        current: currentPipelineCount,
        limit: maxPipelines,
        upgrade: true
      });
    }

    // Validate stages
    if (!stages || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ message: 'Pipeline must have at least one stage' });
    }

    // Validate each stage has required fields
    for (let i = 0; i < stages.length; i++) {
      if (!stages[i].id || !stages[i].title) {
        return res.status(400).json({ message: 'Each stage must have id and title' });
      }
      stages[i].position = i;
    }

    // If marking as default, unset other defaults
    if (isDefault) {
      await Pipeline.updateMany(
        { workspace, isDefault: true },
        { isDefault: false }
      );
    }

    const pipeline = await Pipeline.create({
      workspace,
      name,
      description,
      stages,
      isDefault: isDefault || false
    });

    res.status(201).json({ success: true, pipeline });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Pipeline name already exists in this workspace' });
    }
    next(err);
  }
}

/**
 * List all pipelines for workspace
 */
async function listPipelines(req, res, next) {
  try {
    const workspace = req.user.workspace;

    const pipelines = await Pipeline.find({ workspace }).sort({ createdAt: -1 });
    res.json({ pipelines });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single pipeline
 */
async function getPipeline(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const pipeline = await Pipeline.findOne({ _id: req.params.id, workspace });

    if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
}

/**
 * Update pipeline
 */
async function updatePipeline(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { name, description, stages, isDefault } = req.body;

    const pipeline = await Pipeline.findOne({ _id: req.params.id, workspace });
    if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });

    // Update basic fields
    if (name) pipeline.name = name;
    if (description) pipeline.description = description;
    
    // Update stages if provided
    if (stages && Array.isArray(stages)) {
      for (let i = 0; i < stages.length; i++) {
        stages[i].position = i;
      }
      pipeline.stages = stages;
    }

    // Handle default pipeline change
    if (isDefault && !pipeline.isDefault) {
      await Pipeline.updateMany(
        { workspace, _id: { $ne: pipeline._id }, isDefault: true },
        { isDefault: false }
      );
      pipeline.isDefault = true;
    } else if (isDefault === false) {
      pipeline.isDefault = false;
    }

    await pipeline.save();
    res.json({ success: true, pipeline });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Pipeline name already exists in this workspace' });
    }
    next(err);
  }
}

/**
 * Delete pipeline (only if no active deals)
 */
async function deletePipeline(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const pipeline = await Pipeline.findOne({ _id: req.params.id, workspace });

    if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });

    // Check if any active deals exist for this pipeline
    const activeDealCount = await Deal.countDocuments({
      pipeline: req.params.id,
      status: 'active'
    });

    if (activeDealCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete pipeline with ${activeDealCount} active deal(s)` 
      });
    }

    // If this was default, make another pipeline default
    if (pipeline.isDefault) {
      const anotherPipeline = await Pipeline.findOne({
        workspace,
        _id: { $ne: req.params.id }
      });
      if (anotherPipeline) {
        anotherPipeline.isDefault = true;
        await anotherPipeline.save();
      }
    }

    await Pipeline.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Get default pipeline for workspace
 */
async function getDefaultPipeline(req, res, next) {
  try {
    const workspace = req.user.workspace;
    let pipeline = await Pipeline.findOne({ workspace, isDefault: true });

    // If no default, create one
    if (!pipeline) {
      const defaultStages = [
        { id: 'leads', title: 'Leads', position: 0, color: '#6B7280' },
        { id: 'qualified', title: 'Qualified', position: 1, color: '#3B82F6' },
        { id: 'proposal', title: 'Proposal', position: 2, color: '#8B5CF6' },
        { id: 'won', title: 'Won', position: 3, isFinal: true, color: '#10B981' },
        { id: 'lost', title: 'Lost', position: 4, isFinal: true, color: '#EF4444' }
      ];

      pipeline = await Pipeline.create({
        workspace,
        name: 'Default Sales Pipeline',
        stages: defaultStages,
        isDefault: true
      });
    }

    res.json(pipeline);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPipeline,
  listPipelines,
  getPipeline,
  updatePipeline,
  deletePipeline,
  getDefaultPipeline
};
