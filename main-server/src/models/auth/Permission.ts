import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IPermissionsConfig {
  viewAllConversations: boolean;
  assignConversations: boolean;
  resolveConversations: boolean;
  
  sendMessages: boolean;
  sendTemplates: boolean;
  sendCampaigns: boolean;
  scheduleMessages: boolean;
  
  viewContacts: boolean;
  createContacts: boolean;
  editContacts: boolean;
  deleteContacts: boolean;
  importContacts: boolean;
  exportContacts: boolean;
  
  viewTemplates: boolean;
  createTemplates: boolean;
  editTemplates: boolean;
  deleteTemplates: boolean;
  submitTemplates: boolean;
  
  viewCampaigns: boolean;
  createCampaigns: boolean;
  editCampaigns: boolean;
  launchCampaigns: boolean;
  pauseCampaigns: boolean;
  
  viewDeals: boolean;
  createDeals: boolean;
  editDeals: boolean;
  deleteDeals: boolean;
  
  manageTeam: boolean;
  manageBilling: boolean;
  manageIntegrations: boolean;
  manageWebhooks: boolean;
  viewAuditLogs: boolean;
  
  billing: {
    view: boolean;
    manage: boolean;
  };
  
  viewAnalytics: boolean;
  viewReports: boolean;
  exportData: boolean;
}

export interface IPermission {
  workspace: Types.ObjectId;
  user: Types.ObjectId;
  role: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';
  permissions: IPermissionsConfig;
  
  assignedTags: string[];
  assignedPhones: string[];
  
  isActive: boolean;
  isAvailable: boolean;
  isOnline: boolean;
  lastSeenAt?: Date;
  maxConcurrentChats: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IPermissionDocument extends IPermission, Document {}

export interface IPermissionModel extends Model<IPermissionDocument> {
  getDefaultPermissions(role: string): IPermissionsConfig;
  seedOwnerPermissions(workspaceId: string | Types.ObjectId, userId: string | Types.ObjectId): Promise<IPermissionDocument>;
  checkAccess(
    workspaceId: Types.ObjectId | string, 
    userId: Types.ObjectId | string, 
    permissionKey: keyof IPermissionsConfig,
    context?: { teamId?: string | Types.ObjectId; conversationId?: string | Types.ObjectId }
  ): Promise<boolean>;
  isLead(
    workspaceId: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    teamId: Types.ObjectId | string
  ): Promise<boolean>;
}

const PermissionSchema = new Schema<IPermissionDocument, IPermissionModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true },
  
  permissions: {
    viewAllConversations: { type: Boolean, default: false },
    assignConversations: { type: Boolean, default: false },
    resolveConversations: { type: Boolean, default: false },

    sendMessages: { type: Boolean, default: true },
    sendTemplates: { type: Boolean, default: true },
    sendCampaigns: { type: Boolean, default: false },
    scheduleMessages: { type: Boolean, default: false },

    viewContacts: { type: Boolean, default: true },
    createContacts: { type: Boolean, default: true },
    editContacts: { type: Boolean, default: true },
    deleteContacts: { type: Boolean, default: false },
    importContacts: { type: Boolean, default: false },
    exportContacts: { type: Boolean, default: false },

    viewTemplates: { type: Boolean, default: true },
    createTemplates: { type: Boolean, default: false },
    editTemplates: { type: Boolean, default: false },
    deleteTemplates: { type: Boolean, default: false },
    submitTemplates: { type: Boolean, default: false },

    viewCampaigns: { type: Boolean, default: true },
    createCampaigns: { type: Boolean, default: false },
    editCampaigns: { type: Boolean, default: false },
    launchCampaigns: { type: Boolean, default: false },
    pauseCampaigns: { type: Boolean, default: false },

    viewDeals: { type: Boolean, default: true },
    createDeals: { type: Boolean, default: true },
    editDeals: { type: Boolean, default: true },
    deleteDeals: { type: Boolean, default: false },

    manageTeam: { type: Boolean, default: false },
    manageBilling: { type: Boolean, default: false },
    manageIntegrations: { type: Boolean, default: false },
    manageWebhooks: { type: Boolean, default: false },
    viewAuditLogs: { type: Boolean, default: false },

    billing: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false }
    },

    viewAnalytics: { type: Boolean, default: true },
    viewReports: { type: Boolean, default: true },
    exportData: { type: Boolean, default: false }
  },

  assignedTags: [{ type: String }],
  assignedPhones: [{ type: String }],
  
  isActive: { type: Boolean, default: true },
  
  isAvailable: { type: Boolean, default: true },
  isOnline: { type: Boolean, default: false },
  lastSeenAt: { type: Date },
  maxConcurrentChats: { type: Number, default: 10 },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PermissionSchema.index({ workspace: 1, user: 1 }, { unique: true });
PermissionSchema.index({ workspace: 1, role: 1 });

PermissionSchema.pre<IPermissionDocument>('save', function() {
  this.updatedAt = new Date();
  if (this.isModified('role')) {
    const defaults = (this.constructor as IPermissionModel).getDefaultPermissions(this.role);
    this.permissions = defaults;
  }
  
});

PermissionSchema.statics.getDefaultPermissions = function(role: string) {
  const defaults: any = {
    owner: {
      viewAllConversations: true, assignConversations: true, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: true, scheduleMessages: true,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: true, importContacts: true, exportContacts: true,
      viewTemplates: true, createTemplates: true, editTemplates: true, deleteTemplates: true, submitTemplates: true,
      viewCampaigns: true, createCampaigns: true, editCampaigns: true, launchCampaigns: true, pauseCampaigns: true,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: true,
      manageTeam: true, manageBilling: true, manageIntegrations: true, manageWebhooks: true, viewAuditLogs: true,
      billing: { view: true, manage: true },
      viewAnalytics: true, viewReports: true, exportData: true
    },
    admin: {
      viewAllConversations: true, assignConversations: true, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: true, scheduleMessages: true,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: true, importContacts: true, exportContacts: true,
      viewTemplates: true, createTemplates: true, editTemplates: true, deleteTemplates: true, submitTemplates: true,
      viewCampaigns: true, createCampaigns: true, editCampaigns: true, launchCampaigns: true, pauseCampaigns: true,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: true,
      manageTeam: true, manageBilling: true, manageIntegrations: true, manageWebhooks: true, viewAuditLogs: true,
      billing: { view: true, manage: true },
      viewAnalytics: true, viewReports: true, exportData: true
    },
    manager: {
      viewAllConversations: true, assignConversations: true, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: true, scheduleMessages: true,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: false, importContacts: true, exportContacts: true,
      viewTemplates: true, createTemplates: true, editTemplates: true, deleteTemplates: false, submitTemplates: true,
      viewCampaigns: true, createCampaigns: true, editCampaigns: true, launchCampaigns: true, pauseCampaigns: true,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: false,
      manageTeam: false, manageBilling: false, manageIntegrations: false, manageWebhooks: false, viewAuditLogs: true,
      billing: { view: true, manage: false },
      viewAnalytics: true, viewReports: true, exportData: true
    },
    agent: {
      viewAllConversations: false, assignConversations: false, resolveConversations: true,
      sendMessages: true, sendTemplates: true, sendCampaigns: false, scheduleMessages: false,
      viewContacts: true, createContacts: true, editContacts: true, deleteContacts: false, importContacts: false, exportContacts: false,
      viewTemplates: true, createTemplates: false, editTemplates: false, deleteTemplates: false, submitTemplates: false,
      viewCampaigns: true, createCampaigns: false, editCampaigns: false, launchCampaigns: false, pauseCampaigns: false,
      viewDeals: true, createDeals: true, editDeals: true, deleteDeals: false,
      manageTeam: false, manageBilling: false, manageIntegrations: false, manageWebhooks: false, viewAuditLogs: false,
      billing: { view: false, manage: false },
      viewAnalytics: false, viewReports: false, exportData: false
    },
    viewer: {
      viewAllConversations: false, assignConversations: false, resolveConversations: false,
      sendMessages: false, sendTemplates: false, sendCampaigns: false, scheduleMessages: false,
      viewContacts: true, createContacts: false, editContacts: false, deleteContacts: false, importContacts: false, exportContacts: false,
      viewTemplates: true, createTemplates: false, editTemplates: false, deleteTemplates: false, submitTemplates: false,
      viewCampaigns: true, createCampaigns: false, editCampaigns: false, launchCampaigns: false, pauseCampaigns: false,
      viewDeals: true, createDeals: false, editDeals: false, deleteDeals: false,
      manageTeam: false, manageBilling: false, manageIntegrations: false, manageWebhooks: false, viewAuditLogs: false,
      billing: { view: false, manage: false },
      viewAnalytics: true, viewReports: true, exportData: false
    }
  };
  return defaults[role] || defaults.viewer;
};

PermissionSchema.statics.seedOwnerPermissions = function(workspaceId, userId) {
  return this.create({
    workspace: workspaceId,
    user: userId,
    role: 'owner',
    permissions: this.getDefaultPermissions('owner')
  });
};

/**
 * Standardized Permission Check Helper
 * Enhanced for Team-Aware Authorization (Lead Privileges)
 */
PermissionSchema.statics.checkAccess = async function(
  workspaceId: Types.ObjectId | string, 
  userId: Types.ObjectId | string, 
  permissionKey: keyof IPermissionsConfig,
  context?: { teamId?: string | Types.ObjectId; conversationId?: string | Types.ObjectId }
): Promise<boolean> {
  const perm = await this.findOne({ 
    workspace: new Types.ObjectId(workspaceId), 
    user: new Types.ObjectId(userId) 
  }).lean();
  
  if (!perm) return false;
  
  const permissions = (perm.permissions || {}) as any;
  const hasGlobalAccess = !!permissions[permissionKey];
  
  // 1. If global access is granted, return true immediately
  if (hasGlobalAccess) return true;

  // 2. LEAD PRIVILEGE BYPASS
  // If the key is one of the "Managerial" keys and context is provided, check Team Lead status
  const managerTasks = ['viewAllConversations', 'assignConversations', 'resolveConversations', 'editContacts'];
  if (context && managerTasks.includes(permissionKey as string)) {
    let targetTeamId = context.teamId;

    // If only conversationId is provided, resolve the team from the conversation
    if (!targetTeamId && context.conversationId) {
      const { Conversation } = await import("../index");
      const conv = await Conversation.findById(context.conversationId).select('team').lean();
      targetTeamId = conv?.team;
    }

    if (targetTeamId) {
      const isLeadInTeam = await (this.constructor as any).isLead(workspaceId, userId, targetTeamId);
      if (isLeadInTeam) return true;
    }
  }
  
  return false;
};

/**
 * Static Helper: Check if a user is a Lead of a specific team
 */
PermissionSchema.statics.isLead = async function(
  workspaceId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  teamId: Types.ObjectId | string
): Promise<boolean> {
  const { Team } = await import("../index");
  const team = await Team.findOne({
    _id: new Types.ObjectId(teamId),
    workspace: new Types.ObjectId(workspaceId),
    'members.user': new Types.ObjectId(userId),
    'members.role': 'lead',
    isActive: true
  }).lean();

  return !!team;
};

export const Permission = (mongoose.models.Permission as IPermissionModel) || mongoose.model<IPermissionDocument, IPermissionModel>('Permission', PermissionSchema);


