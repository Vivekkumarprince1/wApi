/**
 * DATA TRANSFORMERS
 * Utilities for transforming data between different formats
 */

/**
 * Transform contact data for API responses
 */
function transformContact(contact, options = {}) {
  if (!contact) return null;

  const transformed = {
    id: contact._id,
    phone: contact.phone,
    name: contact.name,
    tags: contact.tags || [],
    metadata: contact.metadata || {},
    optOut: contact.optOut || { status: false },
    lastInboundAt: contact.lastInboundAt,
    lastOutboundAt: contact.lastOutboundAt,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
  };

  // Include additional fields based on options
  if (options.includeWorkspace) {
    transformed.workspaceId = contact.workspace;
  }

  if (options.includeSales) {
    transformed.activeDealId = contact.activeDealId;
    transformed.activePipelineId = contact.activePipelineId;
    transformed.assignedAgentId = contact.assignedAgentId;
  }

  return transformed;
}

/**
 * Transform template data for API responses
 */
function transformTemplate(template, options = {}) {
  if (!template) return null;

  const transformed = {
    id: template._id,
    name: template.name,
    language: template.language,
    category: template.category,
    status: template.status,
    components: template.components || [],
    variables: template.variables || [],
    rejectionReason: template.rejectionReason,
    submittedAt: template.submittedAt,
    approvedAt: template.approvedAt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };

  // Include additional fields based on options
  if (options.includeWorkspace) {
    transformed.workspaceId = template.workspace;
  }

  if (options.includeMeta) {
    transformed.metaTemplateId = template.metaTemplateId;
    transformed.metaMessageTemplateId = template.metaMessageTemplateId;
  }

  return transformed;
}

/**
 * Transform campaign data for API responses
 */
function transformCampaign(campaign, options = {}) {
  if (!campaign) return null;

  const transformed = {
    id: campaign._id,
    name: campaign.name,
    status: campaign.status,
    templateId: campaign.templateId,
    totalContacts: campaign.totalContacts || 0,
    sentCount: campaign.sentCount || 0,
    deliveredCount: campaign.deliveredCount || 0,
    readCount: campaign.readCount || 0,
    failedCount: campaign.failedCount || 0,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt
  };

  // Include additional fields based on options
  if (options.includeContacts) {
    transformed.contactIds = campaign.contactIds;
  }

  if (options.includeWorkspace) {
    transformed.workspaceId = campaign.workspace;
  }

  if (options.includeTemplate) {
    transformed.template = campaign.template ? transformTemplate(campaign.template) : null;
  }

  return transformed;
}

/**
 * Transform message data for API responses
 */
function transformMessage(message, options = {}) {
  if (!message) return null;

  const transformed = {
    id: message._id,
    type: message.type,
    direction: message.direction,
    status: message.status,
    content: message.content,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    contactId: message.contactId,
    campaignId: message.campaignId,
    conversationId: message.conversationId,
    sentAt: message.sentAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    failedAt: message.failedAt,
    errorMessage: message.errorMessage,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };

  // Include additional fields based on options
  if (options.includeContact) {
    transformed.contact = message.contact ? transformContact(message.contact) : null;
  }

  if (options.includeWorkspace) {
    transformed.workspaceId = message.workspace;
  }

  return transformed;
}

/**
 * Transform user data for API responses (excluding sensitive info)
 */
function transformUser(user, options = {}) {
  if (!user) return null;

  const transformed = {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  // Include additional fields based on options
  if (options.includeWorkspace) {
    transformed.workspaceId = user.workspace;
  }

  if (options.includeProfile) {
    transformed.avatar = user.avatar;
    transformed.phone = user.phone;
    transformed.timezone = user.timezone;
  }

  return transformed;
}

/**
 * Transform workspace data for API responses
 */
function transformWorkspace(workspace, options = {}) {
  if (!workspace) return null;

  const transformed = {
    id: workspace._id,
    name: workspace.name,
    plan: workspace.plan,
    isActive: workspace.isActive,
    settings: workspace.settings || {},
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };

  // Include additional fields based on options
  if (options.includeBilling) {
    transformed.billing = {
      stripeCustomerId: workspace.stripeCustomerId,
      subscriptionStatus: workspace.subscriptionStatus,
      currentPeriodEnd: workspace.currentPeriodEnd
    };
  }

  if (options.includeUsage) {
    transformed.usage = workspace.usage || {};
  }

  return transformed;
}

/**
 * Transform automation rule data
 */
function transformAutomationRule(rule, options = {}) {
  if (!rule) return null;

  const transformed = {
    id: rule._id,
    name: rule.name,
    description: rule.description,
    trigger: rule.trigger,
    conditions: rule.conditions,
    actions: rule.actions,
    isActive: rule.isActive,
    priority: rule.priority,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt
  };

  // Include additional fields based on options
  if (options.includeWorkspace) {
    transformed.workspaceId = rule.workspace;
  }

  if (options.includeStats) {
    transformed.executionCount = rule.executionCount || 0;
    transformed.lastExecutedAt = rule.lastExecutedAt;
  }

  return transformed;
}

/**
 * Generic array transformer
 */
function transformArray(items, transformer, options = {}) {
  if (!Array.isArray(items)) return [];
  return items.map(item => transformer(item, options)).filter(Boolean);
}

/**
 * Pagination transformer
 */
function transformPaginationResult(result, transformer, options = {}) {
  return {
    data: transformArray(result.documents, transformer, options),
    pagination: result.pagination
  };
}

module.exports = {
  transformContact,
  transformTemplate,
  transformCampaign,
  transformMessage,
  transformUser,
  transformWorkspace,
  transformAutomationRule,
  transformArray,
  transformPaginationResult
};