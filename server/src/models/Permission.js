const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: {
    type: String,
    enum: ['owner', 'manager', 'agent', 'viewer'],
    required: true
  },
  permissions: {
    // Inbox & Conversations
    viewAllConversations: { type: Boolean, default: false },
    assignConversations: { type: Boolean, default: false },
    resolveConversations: { type: Boolean, default: false },

    // Messaging
    sendMessages: { type: Boolean, default: true },
    sendTemplates: { type: Boolean, default: true },
    sendCampaigns: { type: Boolean, default: false },
    scheduleMessages: { type: Boolean, default: false },

    // Contacts
    viewContacts: { type: Boolean, default: true },
    createContacts: { type: Boolean, default: true },
    editContacts: { type: Boolean, default: true },
    deleteContacts: { type: Boolean, default: false },
    importContacts: { type: Boolean, default: false },
    exportContacts: { type: Boolean, default: false },

    // Templates
    viewTemplates: { type: Boolean, default: true },
    createTemplates: { type: Boolean, default: false },
    editTemplates: { type: Boolean, default: false },
    deleteTemplates: { type: Boolean, default: false },
    submitTemplates: { type: Boolean, default: false },

    // Campaigns
    viewCampaigns: { type: Boolean, default: true },
    createCampaigns: { type: Boolean, default: false },
    editCampaigns: { type: Boolean, default: false },
    launchCampaigns: { type: Boolean, default: false },
    pauseCampaigns: { type: Boolean, default: false },

    // CRM & Sales
    viewDeals: { type: Boolean, default: true },
    createDeals: { type: Boolean, default: true },
    editDeals: { type: Boolean, default: true },
    deleteDeals: { type: Boolean, default: false },

    // Settings & Admin
    manageTeam: { type: Boolean, default: false },
    manageBilling: { type: Boolean, default: false },
    manageIntegrations: { type: Boolean, default: false },
    manageWebhooks: { type: Boolean, default: false },
    viewAuditLogs: { type: Boolean, default: false },

    // Billing (RBAC scopes)
    billing: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false }
    },

    // Analytics & Reports
    viewAnalytics: { type: Boolean, default: true },
    viewReports: { type: Boolean, default: true },
    exportData: { type: Boolean, default: false }
  },

  // Agent-specific restrictions
  assignedTags: [{ type: String }], // If set, agent only sees contacts with these tags
  assignedPhones: [{ type: String }], // If set, agent only sees these phone numbers
  
  // Active/Inactive
  isActive: { type: Boolean, default: true },
  
  // ====== STAGE 4 HARDENING: Agent availability ======
  isAvailable: { type: Boolean, default: true },  // Can receive auto-assignments
  isOnline: { type: Boolean, default: false },    // Currently connected via socket
  lastSeenAt: { type: Date },
  maxConcurrentChats: { type: Number, default: 10 }, // Max conversations for auto-assign
  // ====== END STAGE 4 HARDENING ======
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PermissionSchema.index({ workspace: 1, user: 1 }, { unique: true });
PermissionSchema.index({ workspace: 1, role: 1 });

// Pre-save middleware
PermissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // If role changes, update permissions to match role
  if (this.isModified('role')) {
    const defaults = PermissionSchema.statics.getDefaultPermissions(this.role);
    this.permissions = defaults;
  }
  
  next();
});

/**
 * Get default permission set for a role
 */
PermissionSchema.statics.getDefaultPermissions = function(role) {
  const defaults = {
    owner: {
      viewAllConversations: true,
      assignConversations: true,
      resolveConversations: true,
      sendMessages: true,
      sendTemplates: true,
      sendCampaigns: true,
      scheduleMessages: true,
      viewContacts: true,
      createContacts: true,
      editContacts: true,
      deleteContacts: true,
      importContacts: true,
      exportContacts: true,
      viewTemplates: true,
      createTemplates: true,
      editTemplates: true,
      deleteTemplates: true,
      submitTemplates: true,
      viewCampaigns: true,
      createCampaigns: true,
      editCampaigns: true,
      launchCampaigns: true,
      pauseCampaigns: true,
      viewDeals: true,
      createDeals: true,
      editDeals: true,
      deleteDeals: true,
      manageTeam: true,
      manageBilling: true,
      manageIntegrations: true,
      manageWebhooks: true,
      viewAuditLogs: true,
      billing: {
        view: true,
        manage: true
      },
      viewAnalytics: true,
      viewReports: true,
      exportData: true
    },
    manager: {
      viewAllConversations: true,
      assignConversations: true,
      resolveConversations: true,
      sendMessages: true,
      sendTemplates: true,
      sendCampaigns: true,
      scheduleMessages: true,
      viewContacts: true,
      createContacts: true,
      editContacts: true,
      deleteContacts: false,
      importContacts: true,
      exportContacts: true,
      viewTemplates: true,
      createTemplates: true,
      editTemplates: true,
      deleteTemplates: false,
      submitTemplates: true,
      viewCampaigns: true,
      createCampaigns: true,
      editCampaigns: true,
      launchCampaigns: true,
      pauseCampaigns: true,
      viewDeals: true,
      createDeals: true,
      editDeals: true,
      deleteDeals: false,
      manageTeam: false,
      manageBilling: false,
      manageIntegrations: false,
      manageWebhooks: false,
      viewAuditLogs: true,
      billing: {
        view: true,
        manage: false
      },
      viewAnalytics: true,
      viewReports: true,
      exportData: true
    },
    agent: {
      viewAllConversations: false,
      assignConversations: false,
      resolveConversations: true,
      sendMessages: true,
      sendTemplates: true,
      sendCampaigns: false,
      scheduleMessages: false,
      viewContacts: true,
      createContacts: true,
      editContacts: true,
      deleteContacts: false,
      importContacts: false,
      exportContacts: false,
      viewTemplates: true,
      createTemplates: false,
      editTemplates: false,
      deleteTemplates: false,
      submitTemplates: false,
      viewCampaigns: true,
      createCampaigns: false,
      editCampaigns: false,
      launchCampaigns: false,
      pauseCampaigns: false,
      viewDeals: true,
      createDeals: true,
      editDeals: true,
      deleteDeals: false,
      manageTeam: false,
      manageBilling: false,
      manageIntegrations: false,
      manageWebhooks: false,
      viewAuditLogs: false,
      billing: {
        view: false,
        manage: false
      },
      viewAnalytics: false,
      viewReports: false,
      exportData: false
    },
    viewer: {
      viewAllConversations: false,
      assignConversations: false,
      resolveConversations: false,
      sendMessages: false,
      sendTemplates: false,
      sendCampaigns: false,
      scheduleMessages: false,
      viewContacts: true,
      createContacts: false,
      editContacts: false,
      deleteContacts: false,
      importContacts: false,
      exportContacts: false,
      viewTemplates: true,
      createTemplates: false,
      editTemplates: false,
      deleteTemplates: false,
      submitTemplates: false,
      viewCampaigns: true,
      createCampaigns: false,
      editCampaigns: false,
      launchCampaigns: false,
      pauseCampaigns: false,
      viewDeals: true,
      createDeals: false,
      editDeals: false,
      deleteDeals: false,
      manageTeam: false,
      manageBilling: false,
      manageIntegrations: false,
      manageWebhooks: false,
      viewAuditLogs: false,
      billing: {
        view: false,
        manage: false
      },
      viewAnalytics: true,
      viewReports: true,
      exportData: false
    }
  };

  return defaults[role] || defaults.viewer;
};

/**
 * Seed owner permissions for a workspace user
 */
PermissionSchema.statics.seedOwnerPermissions = function(workspaceId, userId) {
  return this.create({
    workspace: workspaceId,
    user: userId,
    role: 'owner',
    permissions: this.getDefaultPermissions('owner')
  });
};

module.exports = mongoose.model('Permission', PermissionSchema);
