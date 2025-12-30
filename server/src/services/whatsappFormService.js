const WhatsAppForm = require('../models/WhatsAppForm');
const WhatsAppFormResponse = require('../models/WhatsAppFormResponse');
const Contact = require('../models/Contact');
const Workspace = require('../models/Workspace');
const axios = require('axios');

/**
 * Create a new WhatsApp form
 */
async function createForm(workspace, formData) {
  try {
    const form = await WhatsAppForm.create({
      workspace,
      ...formData
    });

    return {
      success: true,
      form,
      message: 'Form created successfully'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get all forms for a workspace
 */
async function getForms(workspace, filters = {}) {
  try {
    const query = { workspace, deletedAt: null };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const forms = await WhatsAppForm.find(query)
      .sort({ createdAt: -1 })
      .select('-questions');

    return forms;
  } catch (err) {
    console.error('Error fetching forms:', err);
    return [];
  }
}

/**
 * Get single form with all details
 */
async function getForm(formId) {
  try {
    const form = await WhatsAppForm.findById(formId);
    return form;
  } catch (err) {
    console.error('Error fetching form:', err);
    return null;
  }
}

/**
 * Update form
 */
async function updateForm(formId, updateData) {
  try {
    // Don't allow status change via update (use publish instead)
    delete updateData.status;
    delete updateData.statistics;
    delete updateData.publishedAt;
    delete updateData.publishedBy;

    const form = await WhatsAppForm.findByIdAndUpdate(
      formId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );

    return {
      success: true,
      form,
      message: 'Form updated successfully'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Publish a form (make it active)
 */
async function publishForm(formId, userId) {
  try {
    // Validate form has at least one question
    const form = await WhatsAppForm.findById(formId);
    if (!form) {
      return { success: false, error: 'Form not found' };
    }

    if (!form.questions || form.questions.length === 0) {
      return { success: false, error: 'Form must have at least one question' };
    }

    const published = await WhatsAppForm.findByIdAndUpdate(
      formId,
      {
        status: 'published',
        publishedAt: new Date(),
        publishedBy: userId,
        updatedAt: new Date()
      },
      { new: true }
    );

    return {
      success: true,
      form: published,
      message: 'Form published successfully'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Unpublish a form
 */
async function unpublishForm(formId) {
  try {
    const form = await WhatsAppForm.findByIdAndUpdate(
      formId,
      {
        status: 'draft',
        updatedAt: new Date()
      },
      { new: true }
    );

    return {
      success: true,
      form,
      message: 'Form unpublished successfully'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Delete a form (soft delete)
 */
async function deleteForm(formId) {
  try {
    const form = await WhatsAppForm.findByIdAndUpdate(
      formId,
      {
        deletedAt: new Date(),
        status: 'draft'
      },
      { new: true }
    );

    return {
      success: true,
      message: 'Form deleted successfully'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Start a form response session
 */
async function startFormResponse(workspace, formId, userPhone, userName, sourceType = 'whatsapp') {
  try {
    const form = await WhatsAppForm.findById(formId);
    if (!form || form.status !== 'published') {
      return { success: false, error: 'Form not available' };
    }

    // Check if user already has active session
    const existingSession = await WhatsAppFormResponse.findOne({
      form: formId,
      userPhone,
      status: 'in_progress'
    });

    if (existingSession) {
      return {
        success: true,
        response: existingSession,
        message: 'Resumed existing session'
      };
    }

    // Create new response session
    const response = await WhatsAppFormResponse.create({
      workspace,
      form: formId,
      userPhone,
      userName,
      sessionId: `${formId}-${userPhone}-${Date.now()}`,
      sourceType,
      totalSteps: form.questions.length,
      status: 'in_progress',
      startedAt: new Date(),
      lastActivityAt: new Date()
    });

    // Update form statistics
    await WhatsAppForm.findByIdAndUpdate(formId, {
      $inc: { 'statistics.totalStarts': 1 }
    });

    return {
      success: true,
      response,
      nextQuestion: form.questions[0] || null
    };
  } catch (err) {
    console.error('Error starting form response:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Submit answer to current question
 */
async function submitAnswer(responseId, questionId, answer) {
  try {
    const response = await WhatsAppFormResponse.findById(responseId);
    if (!response || response.status !== 'in_progress') {
      return { success: false, error: 'Session not found or expired' };
    }

    const form = await WhatsAppForm.findById(response.form);
    if (!form) {
      return { success: false, error: 'Form not found' };
    }

    // Find question
    const question = form.questions.find(q => q.id === questionId);
    if (!question) {
      return { success: false, error: 'Question not found' };
    }

    // Validate answer
    const validation = validateAnswer(answer, question);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Store answer
    response.responses.set(questionId, answer);
    response.completedSteps = response.completedSteps + 1 || 1;
    response.currentStep = response.currentStep + 1 || 1;
    response.lastActivityAt = new Date();

    await response.save();

    // Get next question
    const nextQuestion = getNextQuestion(form, response, question);

    // Check if form is completed
    if (!nextQuestion) {
      await completeFormResponse(responseId, form);
      return {
        success: true,
        completed: true,
        message: 'Form completed',
        response
      };
    }

    return {
      success: true,
      nextQuestion,
      progress: {
        current: response.currentStep,
        total: form.questions.length,
        percentage: Math.round((response.currentStep / form.questions.length) * 100)
      }
    };
  } catch (err) {
    console.error('Error submitting answer:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Validate answer against question constraints
 */
function validateAnswer(answer, question) {
  if (question.required && !answer) {
    return { valid: false, error: 'This question is required' };
  }

  if (!answer) {
    return { valid: true };
  }

  switch (question.type) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
        return { valid: false, error: 'Please enter a valid email address' };
      }
      break;

    case 'phone':
      if (!/^[\d\s+\-()]+$/.test(answer) || answer.replace(/\D/g, '').length < 10) {
        return { valid: false, error: 'Please enter a valid phone number' };
      }
      break;

    case 'number':
      if (isNaN(answer)) {
        return { valid: false, error: 'Please enter a valid number' };
      }
      break;

    case 'text':
      if (question.minLength && answer.length < question.minLength) {
        return { valid: false, error: `Minimum ${question.minLength} characters required` };
      }
      if (question.maxLength && answer.length > question.maxLength) {
        return { valid: false, error: `Maximum ${question.maxLength} characters allowed` };
      }
      if (question.pattern) {
        const regex = new RegExp(question.pattern);
        if (!regex.test(answer)) {
          return { valid: false, error: 'Invalid format' };
        }
      }
      break;

    case 'choice':
      if (!question.options.some(opt => opt.value === answer)) {
        return { valid: false, error: 'Invalid option selected' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Get next question based on conditions
 */
function getNextQuestion(form, response, currentQuestion) {
  const currentIndex = form.questions.findIndex(q => q.id === currentQuestion.id);
  if (currentIndex === -1) return null;

  // Get all remaining questions
  const remainingQuestions = form.questions.slice(currentIndex + 1);

  for (const question of remainingQuestions) {
    // Check conditions
    if (question.conditional && question.conditional.enabled) {
      const dependsOnQuestion = form.questions.find(q => q.id === question.conditional.dependsOn);
      if (dependsOnQuestion) {
        const dependsOnAnswer = response.responses.get(question.conditional.dependsOn);
        if (dependsOnAnswer === question.conditional.dependsOnValue) {
          return question;
        }
      }
      // Skip this question if condition not met
      continue;
    }

    return question;
  }

  return null;  // No more questions
}

/**
 * Complete form response and create lead if enabled
 */
async function completeFormResponse(responseId, form) {
  try {
    const response = await WhatsAppFormResponse.findById(responseId);
    if (!response) return;

    response.status = 'completed';
    response.completedAt = new Date();
    response.timeSpent = Math.round((response.completedAt - response.startedAt) / 1000);

    await response.save();

    // Update form statistics
    await WhatsAppForm.findByIdAndUpdate(form._id, {
      $inc: { 'statistics.completedResponses': 1 },
      'statistics.lastResponseAt': new Date(),
      $set: { 'statistics.completionRate': 0 }  // Will be recalculated
    });

    // Create lead if enabled
    if (form.config.saveLead) {
      await createLeadFromResponse(response, form);
    }

    return { success: true };
  } catch (err) {
    console.error('Error completing form response:', err);
  }
}

/**
 * Create a lead from form response
 */
async function createLeadFromResponse(response, form) {
  try {
    // Create contact if doesn't exist
    let contact = await Contact.findOne({
      workspace: response.workspace,
      phone: response.userPhone
    });

    if (!contact) {
      contact = await Contact.create({
        workspace: response.workspace,
        phone: response.userPhone,
        name: response.userName,
        email: response.userEmail,
        source: 'whatsapp_form',
        sourceId: form._id
      });
    }

    // Store responses in contact
    if (!contact.formResponses) {
      contact.formResponses = {};
    }
    contact.formResponses[form._id] = response.responses;
    contact.tags = contact.tags || [];
    contact.tags.push(`form_${form.name.toLowerCase().replace(/\s+/g, '_')}`);

    await contact.save();

    response.contact = contact._id;
    response.convertedToLead = true;
    await response.save();

    return { success: true, contact };
  } catch (err) {
    console.error('Error creating lead from response:', err);
  }
}

/**
 * Get form responses
 */
async function getFormResponses(formId, filters = {}) {
  try {
    const query = { form: formId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.convertedOnly) {
      query.convertedToLead = true;
    }

    const responses = await WhatsAppFormResponse.find(query)
      .populate('contact', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100)
      .skip(filters.skip || 0);

    const total = await WhatsAppFormResponse.countDocuments(query);

    return {
      responses,
      total,
      page: Math.ceil((filters.skip || 0) / (filters.limit || 100)) + 1
    };
  } catch (err) {
    console.error('Error fetching form responses:', err);
    return { responses: [], total: 0 };
  }
}

/**
 * Recalculate form statistics
 */
async function recalculateFormStats(formId) {
  try {
    const form = await WhatsAppForm.findById(formId);
    if (!form) return;

    const stats = await WhatsAppFormResponse.aggregate([
      { $match: { form: mongoose.Types.ObjectId(formId) } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          completed: [
            { $match: { status: 'completed' } },
            { $count: 'count' }
          ],
          abandoned: [
            { $match: { status: 'abandoned' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const totalResponses = stats[0].total[0]?.count || 0;
    const completedResponses = stats[0].completed[0]?.count || 0;
    const abandonedResponses = stats[0].abandoned[0]?.count || 0;
    const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;

    form.statistics.totalResponses = totalResponses;
    form.statistics.completedResponses = completedResponses;
    form.statistics.abandonedResponses = abandonedResponses;
    form.statistics.completionRate = completionRate;

    await form.save();

    return { success: true };
  } catch (err) {
    console.error('Error recalculating stats:', err);
  }
}

module.exports = {
  createForm,
  getForms,
  getForm,
  updateForm,
  publishForm,
  unpublishForm,
  deleteForm,
  startFormResponse,
  submitAnswer,
  completeFormResponse,
  getFormResponses,
  recalculateFormStats,
  validateAnswer
};
