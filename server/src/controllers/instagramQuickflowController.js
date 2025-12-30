const InstagramQuickflow = require('../models/InstagramQuickflow');
const InstagramQuickflowLog = require('../models/InstagramQuickflowLog');
const Workspace = require('../models/Workspace');
const {
  checkInstagramQuickflowLimits,
  getPresetConfig,
  getInstagramQuickflowLimits
} = require('../services/instagramQuickflowService');

/**
 * Create a new Instagram quickflow
 */
async function createInstagramQuickflow(req, res) {
  try {
    const {
      name,
      type,
      triggerType,
      keywords = [],
      matchMode = 'contains',
      response,
      enabled = true,
      preset,
      presetName
    } = req.body;

    const workspace = req.user?.workspace || req.body.workspace;

    // Validation
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    if (!triggerType) {
      return res.status(400).json({ error: 'Trigger type is required' });
    }

    // Check plan limits
    const limitCheck = await checkInstagramQuickflowLimits(workspace);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: limitCheck.reason,
        current: limitCheck.current,
        limit: limitCheck.limit
      });
    }

    // Check Instagram is connected
    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc || !workspaceDoc.instagramConfig?.isConnected) {
      return res.status(400).json({
        error: 'Instagram account must be connected first'
      });
    }

    // Create quickflow
    const quickflow = await InstagramQuickflow.create({
      workspace,
      name,
      type,
      triggerType,
      keywords: keywords.map(k => k.toLowerCase()),
      matchMode,
      response: response || {},
      enabled,
      preset: preset || false,
      presetName
    });

    await quickflow.populate('template');

    res.status(201).json(quickflow);
  } catch (err) {
    console.error('Error creating Instagram quickflow:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * List all Instagram quickflows for workspace
 */
async function listInstagramQuickflows(req, res) {
  try {
    const { enabled, type, triggerType } = req.query;
    const workspace = req.user?.workspace || req.query.workspace;

    const query = { workspace };

    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }

    if (type) {
      query.type = type;
    }

    if (triggerType) {
      query.triggerType = triggerType;
    }

    const quickflows = await InstagramQuickflow.find(query)
      .populate('template')
      .sort({ createdAt: -1 });

    res.json(quickflows);
  } catch (err) {
    console.error('Error listing Instagram quickflows:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get single Instagram quickflow
 */
async function getInstagramQuickflow(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    const quickflow = await InstagramQuickflow.findOne({
      _id: id,
      workspace
    }).populate('template');

    if (!quickflow) {
      return res.status(404).json({ error: 'Quickflow not found' });
    }

    res.json(quickflow);
  } catch (err) {
    console.error('Error getting Instagram quickflow:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update Instagram quickflow
 */
async function updateInstagramQuickflow(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;
    const { keywords, matchMode, response, enabled, ...rest } = req.body;

    const quickflow = await InstagramQuickflow.findOne({
      _id: id,
      workspace
    });

    if (!quickflow) {
      return res.status(404).json({ error: 'Quickflow not found' });
    }

    // Update fields
    if (keywords) {
      quickflow.keywords = keywords.map(k => k.toLowerCase());
    }
    if (matchMode) {
      quickflow.matchMode = matchMode;
    }
    if (response) {
      quickflow.response = { ...quickflow.response, ...response };
    }
    if (enabled !== undefined) {
      quickflow.enabled = enabled;
    }

    // Update other fields
    Object.assign(quickflow, rest);

    await quickflow.save();
    await quickflow.populate('template');

    res.json(quickflow);
  } catch (err) {
    console.error('Error updating Instagram quickflow:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Delete Instagram quickflow
 */
async function deleteInstagramQuickflow(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    const result = await InstagramQuickflow.findOneAndDelete({
      _id: id,
      workspace
    });

    if (!result) {
      return res.status(404).json({ error: 'Quickflow not found' });
    }

    res.json({ message: 'Quickflow deleted successfully' });
  } catch (err) {
    console.error('Error deleting Instagram quickflow:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Toggle Instagram quickflow enabled/disabled
 */
async function toggleInstagramQuickflow(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    const quickflow = await InstagramQuickflow.findOne({
      _id: id,
      workspace
    }).populate('template');

    if (!quickflow) {
      return res.status(404).json({ error: 'Quickflow not found' });
    }

    quickflow.enabled = !quickflow.enabled;
    await quickflow.save();

    res.json(quickflow);
  } catch (err) {
    console.error('Error toggling Instagram quickflow:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get preset quickflow templates
 */
async function getPresetQuickflows(req, res) {
  try {
    const workspace = req.user?.workspace;
    const workspaceDoc = await Workspace.findById(workspace);
    
    const limits = getInstagramQuickflowLimits(workspaceDoc?.plan);

    const presets = [
      {
        id: 'price_please',
        name: 'Price Please',
        description: 'Auto-reply to comments asking about price',
        icon: '💰',
        available: limits.presetsAvailable.includes('price_please'),
        config: getPresetConfig('price_please')
      },
      {
        id: 'giveaway',
        name: 'Giveaway',
        description: 'Auto-reply to giveaway entries',
        icon: '🎁',
        available: limits.presetsAvailable.includes('giveaway'),
        config: getPresetConfig('giveaway')
      },
      {
        id: 'lead_gen',
        name: 'Lead Generation',
        description: 'Capture leads and redirect to WhatsApp',
        icon: '👥',
        available: limits.presetsAvailable.includes('lead_gen'),
        config: getPresetConfig('lead_gen')
      },
      {
        id: 'story_auto_reply',
        name: 'Story Auto Reply',
        description: 'Auto-reply to story replies',
        icon: '📖',
        available: limits.presetsAvailable.includes('story_auto_reply'),
        config: getPresetConfig('story_auto_reply')
      }
    ];

    res.json(presets);
  } catch (err) {
    console.error('Error getting preset quickflows:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Create quickflow from preset
 */
async function createFromPreset(req, res) {
  try {
    const { preset, customization = {} } = req.body;
    const workspace = req.user?.workspace;

    // Get preset config
    const presetConfig = getPresetConfig(preset);
    if (!presetConfig) {
      return res.status(400).json({ error: 'Invalid preset' });
    }

    // Check limits
    const limitCheck = await checkInstagramQuickflowLimits(workspace);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: limitCheck.reason
      });
    }

    // Create quickflow from preset
    const quickflow = await InstagramQuickflow.create({
      workspace,
      ...presetConfig,
      preset: true,
      presetName: preset,
      ...customization
    });

    await quickflow.populate('template');

    res.status(201).json(quickflow);
  } catch (err) {
    console.error('Error creating from preset:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get quickflow statistics/analytics
 */
async function getInstagramQuickflowStats(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    const quickflow = await InstagramQuickflow.findOne({
      _id: id,
      workspace
    });

    if (!quickflow) {
      return res.status(404).json({ error: 'Quickflow not found' });
    }

    const logs = await InstagramQuickflowLog.find({
      workspace,
      quickflow: id
    }).sort({ triggeredAt: -1 }).limit(100);

    const stats = {
      totalTriggered: quickflow.totalTriggered,
      totalRepliesSent: quickflow.totalRepliesSent,
      successRate: quickflow.totalTriggered > 0 
        ? ((quickflow.totalRepliesSent / quickflow.totalTriggered) * 100).toFixed(2)
        : 0,
      lastTriggeredAt: quickflow.lastTriggeredAt,
      lastReplySentAt: quickflow.lastReplySentAt,
      recentLogs: logs
    };

    res.json(stats);
  } catch (err) {
    console.error('Error getting quickflow stats:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createInstagramQuickflow,
  listInstagramQuickflows,
  getInstagramQuickflow,
  updateInstagramQuickflow,
  deleteInstagramQuickflow,
  toggleInstagramQuickflow,
  getPresetQuickflows,
  createFromPreset,
  getInstagramQuickflowStats
};
