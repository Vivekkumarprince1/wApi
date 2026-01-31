const Template = require('../models/Template');
const bspMessagingService = require('./bspMessagingService');
const bspConfig = require('../config/bspConfig');

/**
 * Auto-Template Generation Service
 * Generates safe, personalized starter templates after ESB onboarding
 */

/**
 * Safe starter templates for auto-generation
 * All transactional, safe, and Meta-compliant
 */
const STARTER_TEMPLATES = [
  {
    key: 'welcome',
    namePrefix: 'welcome',
    displayName: 'Welcome Message',
    body: 'Hi {{1}}, thanks for contacting {{COMPANY}}. How can we help you today?',
    category: 'UTILITY',
    components: [
      {
        type: 'body',
        text: 'Hi {{1}}, thanks for contacting {{COMPANY}}. How can we help you today?',
        example: {
          body_text: [['John', 'Acme Corp']]
        }
      }
    ],
    description: 'Welcome message for new contacts'
  },
  {
    key: 'order_confirmation',
    namePrefix: 'order_confirmation',
    displayName: 'Order Confirmation',
    body: 'Thank you! {{COMPANY}} has received your order {{1}}. We\'ll update you shortly.',
    category: 'UTILITY',
    components: [
      {
        type: 'body',
        text: 'Thank you! {{COMPANY}} has received your order {{1}}. We\'ll update you shortly.',
        example: {
          body_text: [['#123456']]
        }
      }
    ],
    description: 'Confirm receipt of customer order'
  },
  {
    key: 'status_update',
    namePrefix: 'status_update',
    displayName: 'Status Update',
    body: 'Hi {{1}}, your request is being processed by {{COMPANY}}. {{2}}',
    category: 'UTILITY',
    components: [
      {
        type: 'body',
        text: 'Hi {{1}}, your request is being processed by {{COMPANY}}. {{2}}',
        example: {
          body_text: [['John', 'Expected delivery: Tomorrow']]
        }
      }
    ],
    description: 'Update customer on request status'
  },
  {
    key: 'support_response',
    namePrefix: 'support_response',
    displayName: 'Support Response',
    body: 'Thanks for reaching out! {{COMPANY}} support is here to help. What can we assist you with?',
    category: 'UTILITY',
    components: [
      {
        type: 'body',
        text: 'Thanks for reaching out! {{COMPANY}} support is here to help. What can we assist you with?'
      }
    ],
    description: 'Auto-response for support inquiries'
  },
  {
    key: 'appointment_reminder',
    namePrefix: 'appointment_reminder',
    displayName: 'Appointment Reminder',
    body: 'Hi {{1}}, reminder: You have an appointment with {{COMPANY}} on {{2}} at {{3}}.',
    category: 'UTILITY',
    components: [
      {
        type: 'body',
        text: 'Hi {{1}}, reminder: You have an appointment with {{COMPANY}} on {{2}} at {{3}}.',
        example: {
          body_text: [['John', 'Dec 25', '2 PM']]
        }
      }
    ],
    description: 'Appointment reminder notification'
  }
];

/**
 * Generate personalized template name
 * @param {string} namePrefix - Base prefix (e.g., 'welcome')
 * @param {string} companyName - Company name for personalization
 * @returns {string} - Personalized template name
 */
function generateTemplateName(namePrefix, companyName) {
  // Clean company name: remove spaces, convert to lowercase, limit length
  const cleanCompanyName = companyName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 20);

  return `${namePrefix}_${cleanCompanyName}`.substring(0, 50); // Meta limit: 50 chars
}

/**
 * Personalize template body with workspace metadata
 * @param {string} body - Template body with {{COMPANY}}, {{INDUSTRY}}, {{DESCRIPTION}} placeholders
 * @param {string} companyName - Company name
 * @param {string} industry - Industry (optional)
 * @param {string} description - Business description (optional)
 * @returns {string} - Personalized body
 */
function personalizeTemplateBody(body, companyName, industry, description) {
  let text = body.replace(/{{COMPANY}}/g, companyName);
  if (industry) {
    text = text.replace(/{{INDUSTRY}}/g, industry);
  }
  if (description) {
    text = text.replace(/{{DESCRIPTION}}/g, description);
  }
  return text;
}

/**
 * Personalize template components
 * @param {Array} components - Component array
 * @param {string} companyName - Company name
 * @param {string} industry - Industry (optional)
 * @param {string} description - Business description (optional)
 * @returns {Array} - Personalized components
 */
function personalizeComponents(components, companyName, industry, description) {
  return components.map(component => {
    if (component.type === 'body' && component.text) {
      return {
        ...component,
        text: personalizeTemplateBody(component.text, companyName, industry, description)
      };
    }
    return component;
  });
}

/**
 * Check if auto-templates already generated for workspace
 * @param {ObjectId} workspaceId - Workspace ID
 * @returns {boolean} - True if already generated
 */
async function hasAlreadyGenerated(workspaceId) {
  const existing = await Template.findOne({
    workspace: workspaceId,
    isSystemGenerated: true,
    generationSource: 'onboarding'
  });

  return !!existing;
}

/**
 * Check if plan limit allows template generation
 * @param {Object} workspace - Workspace document
 * @param {number} templateCount - Number of templates to generate
 * @returns {Object} - { allowed: boolean, reason: string }
 */
async function checkPlanLimits(workspace, templateCount) {
  const PLAN_LIMITS = {
    free: 5,
    basic: 25,
    premium: 100,
    enterprise: -1
  };

  const plan = workspace.plan || 'free';
  const limit = PLAN_LIMITS[plan];

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true };
  }

  const currentCount = await Template.countDocuments({
    workspace: workspace._id
  });

  if (currentCount + templateCount > limit) {
    return {
      allowed: false,
      reason: `Plan limit exceeded. ${plan} plan allows ${limit} templates, current: ${currentCount}`
    };
  }

  return { allowed: true };
}

/**
 * Main function: Generate and submit auto-templates
 * @param {Object} workspace - Workspace document
 * @returns {Object} - Generation result
 */
async function generateAndSubmitTemplates(workspace) {
  try {
    console.log(`[Templates] 🚀 Starting auto-template generation for workspace ${workspace._id}`);

    // ✅ Validation 1: Check if already generated (idempotent)
    const alreadyGenerated = await hasAlreadyGenerated(workspace._id);
    if (alreadyGenerated) {
      console.log(`[Templates] ⏭️ Templates already generated for workspace ${workspace._id}`);
      return {
        success: true,
        skipped: true,
        reason: 'Templates already generated'
      };
    }

    // ✅ Validation 2: Company name exists
    if (!workspace.name || workspace.name.trim().length === 0) {
      return {
        success: false,
        reason: 'Company name not set. Cannot personalize templates.'
      };
    }

    // ✅ Validation 3-5: BSP-managed or legacy WABA checks
    // WHY: Interakt submits via BSP parent WABA when bspManaged is true
    if (workspace.bspManaged) {
      if (!bspConfig.isEnabled()) {
        return {
          success: false,
          reason: 'BSP service not configured. Cannot submit templates.'
        };
      }
      if (!workspace.bspPhoneNumberId) {
        return {
          success: false,
          reason: 'BSP phone number not registered. Cannot generate templates.'
        };
      }
    } else {
      // Legacy direct WABA checks (fallback only)
      if (!workspace.wabaId) {
        return {
          success: false,
          reason: 'WABA not configured. Cannot generate templates.'
        };
      }

      if (!workspace.whatsappPhoneNumberId) {
        return {
          success: false,
          reason: 'Phone number not registered. Cannot generate templates.'
        };
      }

      if (!workspace.whatsappAccessToken) {
        return {
          success: false,
          reason: 'Access token not available. Cannot submit to Meta.'
        };
      }
    }

    // ✅ Validation 6: Check plan limits
    const limitCheck = await checkPlanLimits(workspace, STARTER_TEMPLATES.length);
    if (!limitCheck.allowed) {
      console.warn(`[Templates] Plan limit check failed: ${limitCheck.reason}`);
      return {
        success: false,
        reason: limitCheck.reason
      };
    }

    // ✅ Generation: Create templates
    const generatedTemplates = [];
    const errors = [];

    for (const templateDef of STARTER_TEMPLATES) {
      try {
        // Generate personalized name
        const templateName = generateTemplateName(templateDef.namePrefix, workspace.name);

        // Check if this specific template already exists
        const existingTemplate = await Template.findOne({
          workspace: workspace._id,
          name: templateName
        });

        if (existingTemplate) {
          console.log(`[Templates] Template already exists: ${templateName}`);
          generatedTemplates.push(existingTemplate);
          continue;
        }

        // Personalize template with industry and description
        const personalizedBody = personalizeTemplateBody(
          templateDef.body, 
          workspace.name, 
          workspace.industry || '', 
          workspace.description || ''
        );
        const personalizedComponents = personalizeComponents(
          templateDef.components, 
          workspace.name,
          workspace.industry || '', 
          workspace.description || ''
        );

        // Create template document using canonical structured schema (Interakt-style)
        // WHY: Enforce one schema and avoid raw component drift
        const template = await Template.create({
          workspace: workspace._id,
          name: templateName,
          language: 'en',
          category: templateDef.category,
          header: { enabled: false, format: 'NONE' },
          body: {
            text: personalizedBody,
            examples: templateDef.components?.[0]?.example?.body_text?.[0] || []
          },
          footer: { enabled: false, text: '' },
          buttons: { enabled: false, items: [] },
          components: [],
          status: 'DRAFT',
          source: 'LOCAL',
          isSystemGenerated: true,
          generationSource: 'onboarding',
          generatedForWorkspace: workspace._id,
          generatedAt: new Date(),
          createdBy: null, // System-generated
          preview: templateDef.description,
          bodyText: personalizedBody,
          variables: extractVariables(personalizedBody)
        });

        console.log(`[Templates] ✅ Created template (DRAFT): ${templateName}`);

        // Auto-submit via BSP parent WABA (Interakt requirement)
        // WHY: All template submissions must go through centralized BSP service
        if (bspConfig.isEnabled() && workspace.bspManaged && workspace.bspPhoneNumberId) {
          try {
            const metaComponents = template.buildMetaComponents();
            const result = await bspMessagingService.submitTemplate(
              workspace._id,
              {
                name: template.name,
                language: template.language,
                category: template.category,
                components: metaComponents
              }
            );

            template.status = 'PENDING';
            template.metaTemplateId = result.templateId;
            template.metaTemplateName = result.namespacedName;
            template.submittedAt = new Date();
            template.submittedVia = 'BSP';
            template.metaPayloadSnapshot = {
              components: metaComponents,
              name: template.name,
              language: template.language,
              category: template.category,
              submittedAt: new Date(),
              raw: result.data || null
            };
            template.approvalHistory.push({
              status: 'PENDING',
              timestamp: new Date(),
              source: 'BSP_SUBMISSION',
              reason: 'Auto-generated onboarding template'
            });

            await template.save();
            console.log(`[Templates] 📤 Auto-submitted template via BSP: ${template.metaTemplateName}`);
          } catch (submitErr) {
            template.approvalHistory.push({
              status: 'SUBMISSION_FAILED',
              timestamp: new Date(),
              source: 'BSP_ERROR',
              reason: submitErr.message
            });
            await template.save();
            console.error(`[Templates] ❌ Auto-submit failed for ${templateName}:`, submitErr.message);
          }
        }
        generatedTemplates.push(template);
      } catch (templateError) {
        console.error(`[Templates] ❌ Failed to create template:`, templateError.message);
        errors.push({
          templateDef: templateDef.displayName,
          error: templateError.message
        });
      }
    }

    // Update workspace usage counter
    try {
      workspace.usage.templates = (workspace.usage.templates || 0) + generatedTemplates.length;
      await workspace.save();
    } catch (usageError) {
      console.warn(`[Templates] Failed to update workspace usage:`, usageError.message);
    }

    console.log(`[Templates] ✅ Auto-generation complete. Created ${generatedTemplates.length} templates.`);

    return {
      success: true,
      created: generatedTemplates.length,
      templates: generatedTemplates,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (err) {
    console.error(`[Templates] ❌ Template generation failed:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Extract variables from template body
 * @param {string} body - Template body
 * @returns {Array} - Array of variable names
 */
function extractVariables(body) {
  const matches = body.match(/{{(\d+)}}/g) || [];
  return matches.map(match => match.replace(/[{}]/g, ''));
}

module.exports = {
  generateAndSubmitTemplates,
  hasAlreadyGenerated,
  checkPlanLimits,
  generateTemplateName,
  personalizeTemplateBody
};
