const WhatsAppForm = require('../models/WhatsAppForm');
const WhatsAppFormResponse = require('../models/WhatsAppFormResponse');
const {
  createForm,
  getForms,
  getForm,
  updateForm,
  publishForm,
  unpublishForm,
  deleteForm,
  startFormResponse,
  submitAnswer,
  getFormResponses,
  recalculateFormStats
} = require('../services/whatsappFormService');

/**
 * Create a new WhatsApp form
 */
async function createWhatsAppForm(req, res) {
  try {
    const workspace = req.user?.workspace || req.body.workspace;
    const { name, description, questions = [], config = {}, behavior = {} } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Form name is required' });
    }

    if (questions.length === 0) {
      return res.status(400).json({ error: 'Form must have at least one question' });
    }

    const result = await createForm(workspace, {
      name,
      description,
      questions,
      config,
      behavior,
      createdBy: req.user?._id
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json(result.form);
  } catch (err) {
    console.error('Error creating form:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get all forms for workspace
 */
async function listWhatsAppForms(req, res) {
  try {
    const workspace = req.user?.workspace;
    const { status, search } = req.query;

    const forms = await getForms(workspace, {
      status,
      search
    });

    res.json(forms);
  } catch (err) {
    console.error('Error fetching forms:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get single form
 */
async function getWhatsAppForm(req, res) {
  try {
    const { id } = req.params;

    const form = await getForm(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Check workspace access
    if (form.workspace.toString() !== (req.user?.workspace || req.body.workspace)?.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(form);
  } catch (err) {
    console.error('Error fetching form:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update form
 */
async function updateWhatsAppForm(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    // Check access
    const form = await WhatsAppForm.findById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.workspace.toString() !== workspace.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await updateForm(id, req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.form);
  } catch (err) {
    console.error('Error updating form:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Publish form
 */
async function publishWhatsAppForm(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    // Check access
    const form = await WhatsAppForm.findById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.workspace.toString() !== workspace.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await publishForm(id, req.user?._id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.form);
  } catch (err) {
    console.error('Error publishing form:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Unpublish form
 */
async function unpublishWhatsAppForm(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    // Check access
    const form = await WhatsAppForm.findById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.workspace.toString() !== workspace.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await unpublishForm(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.form);
  } catch (err) {
    console.error('Error unpublishing form:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Delete form
 */
async function deleteWhatsAppForm(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    // Check access
    const form = await WhatsAppForm.findById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.workspace.toString() !== workspace.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await deleteForm(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Form deleted successfully' });
  } catch (err) {
    console.error('Error deleting form:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get form responses
 */
async function getWhatsAppFormResponses(req, res) {
  try {
    const { id } = req.params;
    const { status, convertedOnly, limit = 50, skip = 0 } = req.query;
    const workspace = req.user?.workspace;

    // Check access
    const form = await WhatsAppForm.findById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.workspace.toString() !== workspace.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const data = await getFormResponses(id, {
      status,
      convertedOnly: convertedOnly === 'true',
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json(data);
  } catch (err) {
    console.error('Error fetching responses:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Sync/Recalculate form data
 */
async function syncFormData(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    // Check access
    const form = await WhatsAppForm.findById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.workspace.toString() !== workspace.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await recalculateFormStats(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const updated = await getForm(id);
    res.json({
      message: 'Form data synced successfully',
      statistics: updated.statistics
    });
  } catch (err) {
    console.error('Error syncing form data:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Start form response (user initiates form)
 */
async function startWhatsAppFormResponse(req, res) {
  try {
    const { formId } = req.body;
    const { userPhone, userName, sourceType = 'whatsapp' } = req.body;
    const workspace = req.user?.workspace || req.body.workspace;

    if (!formId || !userPhone) {
      return res.status(400).json({ error: 'Form ID and phone number required' });
    }

    const result = await startFormResponse(workspace, formId, userPhone, userName, sourceType);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      response: result.response,
      nextQuestion: result.nextQuestion,
      message: result.message
    });
  } catch (err) {
    console.error('Error starting form:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Submit answer (user responds to question)
 */
async function submitFormAnswer(req, res) {
  try {
    const { responseId, questionId, answer } = req.body;

    if (!responseId || !questionId || answer === undefined) {
      return res.status(400).json({ error: 'Response ID, question ID, and answer required' });
    }

    const result = await submitAnswer(responseId, questionId, answer);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      completed: result.completed,
      nextQuestion: result.nextQuestion,
      progress: result.progress,
      message: result.message
    });
  } catch (err) {
    console.error('Error submitting answer:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get form statistics
 */
async function getFormStats(req, res) {
  try {
    const { id } = req.params;
    const workspace = req.user?.workspace;

    const form = await WhatsAppForm.findById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.workspace.toString() !== workspace.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      statistics: form.statistics,
      questions: form.questions.length,
      status: form.status
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createWhatsAppForm,
  listWhatsAppForms,
  getWhatsAppForm,
  updateWhatsAppForm,
  publishWhatsAppForm,
  unpublishWhatsAppForm,
  deleteWhatsAppForm,
  getWhatsAppFormResponses,
  syncFormData,
  startWhatsAppFormResponse,
  submitFormAnswer,
  getFormStats
};
