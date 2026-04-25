const answerBotService = require('../../services/automation/answerbotService');
const { FAQ } = require('../../models');

/**
 * Generate FAQs from website URL
 * POST /api/automation/answerbot/generate
 */
const generateFAQs = async (req, res) => {
  try {
    const { websiteUrl } = req.body;
    const { workspaceId } = req.params;

    // Validate input
    if (!websiteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Website URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(websiteUrl);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid website URL format'
      });
    }

    // Generate FAQs from website
    const result = await answerBotService.generateFAQsFromWebsite(
      workspaceId,
      websiteUrl
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Return FAQs as draft
    return res.status(200).json({
      success: true,
      faqs: result.faqs,
      source: result.source,
      message: result.message || 'FAQs generated successfully'
    });
  } catch (err) {
    console.error('[AnswerBot Controller] Error in generateFAQs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate FAQs'
    });
  }
};

/**
 * Get all FAQs for workspace
 * GET /api/automation/answerbot/faqs
 */
const getFAQs = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { status, source, limit = 100, skip = 0 } = req.query;

    // Build filters
    const filters = {};
    if (status) {
      filters.status = status;
    }
    if (source) {
      filters.source = source;
    }

    // Get FAQs
    const faqs = await answerBotService.getFAQs(workspaceId, filters);

    // Apply pagination
    const paginatedFAQs = faqs.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    return res.status(200).json({
      success: true,
      faqs: paginatedFAQs,
      total: faqs.length,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (err) {
    console.error('[AnswerBot Controller] Error in getFAQs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FAQs'
    });
  }
};

/**
 * Approve FAQs for use in auto-replies
 * POST /api/automation/answerbot/approve
 */
const approveFAQs = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { faqIds } = req.body;

    // Validate input
    if (!Array.isArray(faqIds) || faqIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'FAQ IDs array is required and must not be empty'
      });
    }

    // Approve FAQs
    const result = await answerBotService.approveFAQs(workspaceId, faqIds);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[AnswerBot Controller] Error in approveFAQs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to approve FAQs'
    });
  }
};

/**
 * Delete FAQ
 * DELETE /api/automation/answerbot/faqs/:faqId
 */
const deleteFAQ = async (req, res) => {
  try {
    const { workspaceId, faqId } = req.params;

    const result = await answerBotService.deleteFAQ(workspaceId, faqId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[AnswerBot Controller] Error in deleteFAQ:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
    });
  }
};

/**
 * Get AnswerBot sources (crawled websites)
 * GET /api/automation/answerbot/sources
 */
const getSources = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const sources = await answerBotService.getAnswerBotSources(workspaceId);

    return res.status(200).json({
      success: true,
      sources
    });
  } catch (err) {
    console.error('[AnswerBot Controller] Error in getSources:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sources'
    });
  }
};

/**
 * Get AnswerBot Settings
 * GET /api/automation/answerbot/settings
 */
const getSettings = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const AnswerBotSettings = require('../../models/automation/AnswerBotSettings');
    let settings = await AnswerBotSettings.findOne({ workspace: workspaceId });
    
    if (!settings) {
      settings = await AnswerBotSettings.create({ workspace: workspaceId });
    }
    
    return res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error('[AnswerBot Controller] Error in getSettings:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

/**
 * Update AnswerBot Settings
 * PUT /api/automation/answerbot/settings
 */
const updateSettings = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const updates = req.body;
    const AnswerBotSettings = require('../../models/automation/AnswerBotSettings');
    
    const settings = await AnswerBotSettings.findOneAndUpdate(
      { workspace: workspaceId },
      { $set: updates },
      { new: true, upsert: true }
    );
    
    return res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error('[AnswerBot Controller] Error in updateSettings:', err);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};

/**
 * Add an AnswerBot Source (URL, Text, Document)
 * POST /api/automation/answerbot/sources
 */
const addSource = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { sourceType, title, websiteUrl, textContent, documentData } = req.body;
    const AnswerBotSource = require('../../models/automation/AnswerBotSource');
    
    // Default to 'url' for legacy compatibility
    const type = sourceType || 'url';
    
    if (type === 'url' && !websiteUrl) {
      return res.status(400).json({ success: false, error: 'Website URL required for URL sources' });
    }
    if (type === 'text' && !textContent) {
      return res.status(400).json({ success: false, error: 'Text content required for Text sources' });
    }
    
    const source = await AnswerBotSource.create({
      workspace: workspaceId,
      sourceType: type,
      title: title || (type === 'url' ? websiteUrl : 'New Source'),
      websiteUrl,
      textContent,
      documentData,
      crawlStatus: type === 'url' ? 'in_progress' : 'completed',
      faqCount: 0
    });
    
    // For MVP: we just save it as completed if it's text/doc, 
    // and wait for background worker for URL.
    return res.status(201).json({ success: true, source });
  } catch (err) {
    console.error('[AnswerBot Controller] Error in addSource:', err);
    res.status(500).json({ success: false, error: 'Failed to add source' });
  }
};

module.exports = {
  generateFAQs,
  getFAQs,
  approveFAQs,
  deleteFAQ,
  getSources,
  addSource,
  getSettings,
  updateSettings
};
