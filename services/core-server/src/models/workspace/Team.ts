import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type TeamRole = 'lead' | 'member';
export type TeamVisibility = 'team_only' | 'all';
export type AutoAssignStrategy = 'round_robin' | 'least_busy' | 'random';

export interface ITeamMember {
  user: Types.ObjectId;
  role: TeamRole;
  addedAt: Date;
}

export interface ITeam {
  workspace: Types.ObjectId;
  name: string;
  description?: string;
  members: ITeamMember[];
  visibility: TeamVisibility;
  autoAssign: {
    enabled: boolean;
    strategy: AutoAssignStrategy;
    lastAssignedIndex: number;
  };
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamDocument extends ITeam, Document {
  addMember(userId: Types.ObjectId | string, role?: TeamRole): this;
  removeMember(userId: Types.ObjectId | string): this;
  isLead(userId: Types.ObjectId | string): boolean;
  hasMember(userId: Types.ObjectId | string): boolean;
  getLeads(): ITeamMember[];
}

export interface ITeamModel extends Model<ITeamDocument> {
  findByUser(workspaceId: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<ITeamDocument[]>;
  findAutoAssignTeams(workspaceId: Types.ObjectId | string): Promise<ITeamDocument[]>;
}

const TeamSchema = new Schema<ITeamDocument>({
  workspace: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  description: {
    type: String,
    trim: true,
    maxLength: 500
  },
  members: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['lead', 'member'],
      default: 'member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    _id: false
  }],
  visibility: {
    type: String,
    enum: ['team_only', 'all'],
    default: 'team_only'
  },
  autoAssign: {
    enabled: { type: Boolean, default: false },
    strategy: {
      type: String,
      enum: ['round_robin', 'least_busy', 'random'],
      default: 'round_robin'
    },
    lastAssignedIndex: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
TeamSchema.index({ workspace: 1, name: 1 }, { unique: true });
TeamSchema.index({ workspace: 1, 'members.user': 1 });
TeamSchema.index({ workspace: 1, isActive: 1 });

// Virtuals
TeamSchema.virtual('memberCount').get(function(this: ITeamDocument) {
  return this.members?.length || 0;
});

// Instance Methods
TeamSchema.methods.addMember = function(userId: Types.ObjectId | string, role: TeamRole = 'member') {
  const existing = this.members.find((m: ITeamMember) => m.user.toString() === userId.toString());
  if (existing) {
    existing.role = role;
  } else {
    this.members.push({ user: new Types.ObjectId(userId), role, addedAt: new Date() });
  }
  return this;
};

TeamSchema.methods.removeMember = function(userId: Types.ObjectId | string) {
  this.members = this.members.filter((m: ITeamMember) => m.user.toString() !== userId.toString());
  return this;
};

TeamSchema.methods.isLead = function(userId: Types.ObjectId | string) {
  return this.members.some((m: ITeamMember) => m.user.toString() === userId.toString() && m.role === 'lead');
};

TeamSchema.methods.hasMember = function(userId: Types.ObjectId | string) {
  return this.members.some((m: ITeamMember) => m.user.toString() === userId.toString());
};

TeamSchema.methods.getLeads = function() {
  return this.members.filter((m: ITeamMember) => m.role === 'lead');
};

// Static Methods
TeamSchema.statics.findByUser = function(workspaceId: Types.ObjectId | string, userId: Types.ObjectId | string) {
  return this.find({
    workspace: new Types.ObjectId(workspaceId),
    'members.user': new Types.ObjectId(userId),
    isActive: true
  });
};

TeamSchema.statics.findAutoAssignTeams = function(workspaceId: Types.ObjectId | string) {
  return this.find({
    workspace: new Types.ObjectId(workspaceId),
    isActive: true,
    'autoAssign.enabled': true
  });
};

export const Team: ITeamModel = (mongoose.models.Team as ITeamModel) || mongoose.model<ITeamDocument, ITeamModel>('Team', TeamSchema);
