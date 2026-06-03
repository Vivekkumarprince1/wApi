import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-SCHEMAS & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IApprovalHistory {
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'IN_APPEAL' | 'PENDING_DELETION' | 'DELETED' | 'LIMIT_EXCEEDED' | 'FAILED';
  reason?: string;
  timestamp: Date;
  metaEventId?: string;
  rawEvent?: any;
}

export interface IEditHistory {
  action: 'DIRECT_EDIT' | 'APPROVED_FORK_CREATED' | 'APPROVED_FORK_SUBMITTED' | 'APPROVED_FORK_SUBMISSION_FAILED';
  timestamp: Date;
  actor?: Types.ObjectId;
  sourceTemplateId?: Types.ObjectId;
  details?: any;
}

export interface ITemplateHeader {
  enabled: boolean;
  format: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  mediaUrl?: string;
  mediaHandle?: string;
  mediaThumbnail?: string;
  variables?: string[];
  example?: string;
}

export interface ITemplateBody {
  text: string;
  variables?: string[];
  examples?: string[];
}

export interface ITemplateFooter {
  enabled: boolean;
  text?: string;
}

export interface ITemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP' | 'CATALOG' | 'FLOW';
  text: string;
  url?: string;
  urlSuffix?: string;
  phoneNumber?: string;
  otp_type?: string;
  example?: string;
  flowId?: string;
  navigateScreen?: string;
  flowAction?: string;
}

export interface ITemplateLto {
  enabled: boolean;
  hasExpiration: boolean;
  expirationTimeMs?: number;
}

export interface ICarouselCard {
  headerFormat: 'IMAGE' | 'VIDEO';
  mediaUrl?: string;
  mediaHandle?: string;
  bodyText: string;
  buttons: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phoneNumber?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEMPLATE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ITemplate {
  workspace: Types.ObjectId;
  createdBy?: Types.ObjectId;
  
  name: string;
  displayName?: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  
  header: ITemplateHeader;
  body: ITemplateBody;
  footer: ITemplateFooter;
  buttons: {
    enabled: boolean;
    items: ITemplateButton[];
  };

  templateType: 'STANDARD' | 'CAROUSEL' | 'LTO';
  lto?: ITemplateLto;
  carousel?: {
    cards: ICarouselCard[];
  };

  components: any[];
  
  metaTemplateId?: string;
  providerId?: string;
  metaTemplateName?: string;
  partnerAppId?: string;
  submittedVia?: 'BSP' | 'DIRECT' | 'MANUAL' | null;

  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'IN_APPEAL' | 'PENDING_DELETION' | 'DELETED' | 'LIMIT_EXCEEDED' | 'FAILED';
  rejectionReason?: string;
  rejectionDetails?: {
    reason?: string;
    code?: string;
    description?: string;
    timestamp?: Date;
  };
  
  approvalHistory: IApprovalHistory[];
  editHistory: IEditHistory[];
  qualityScore: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  parameterFormat: 'POSITIONAL' | 'NAMED';
  
  variables: string[];
  variableCount: number;
  
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  buttonLabels: string[];
  preview?: string;

  version: number;
  lastEditedBy?: Types.ObjectId;
  lastEditedAt?: Date;

  originalTemplateId?: Types.ObjectId;
  isActiveVersion: boolean;

  metaPayloadSnapshot?: {
    components?: any[];
    name?: string;
    language?: string;
    category?: string;
    submittedAt?: Date;
    raw?: any;
  };

  usedInCampaigns: number;
  lastUsedAt?: Date;
  
  lastWebhookUpdate?: Date;
  lastWebhookEventId?: string;

  source: 'META' | 'LOCAL' | 'BSP';
  duplicatedFrom?: Types.ObjectId;

  lastSyncedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemplateDocument extends ITemplate, Document {}

export interface ITemplateModel extends Model<ITemplateDocument> {
  getValidMetaCategory(category: string): string;
  getSupportedLanguages(): Record<string, string>;
  findByMetaTemplateName(metaTemplateName: string): Promise<ITemplateDocument | null>;
  findByWorkspace(workspaceId: Types.ObjectId, options?: any): Promise<ITemplateDocument[]>;
  getApprovedTemplates(workspaceId: Types.ObjectId, options?: any): Promise<ITemplateDocument[]>;
  getApprovedTemplateById(templateId: Types.ObjectId, workspaceId: Types.ObjectId): Promise<ITemplateDocument | null>;
  requireApprovedTemplate(templateId: Types.ObjectId, workspaceId: Types.ObjectId): Promise<ITemplateDocument>;
  getStatusCounts(workspaceId: Types.ObjectId): Promise<Record<string, number>>;
  cloneApprovedTemplate(templateId: Types.ObjectId, userId: Types.ObjectId, options?: any): Promise<ITemplateDocument | any>;
}

// Valid Meta categories - only these 3 are accepted by WhatsApp API
const VALID_META_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

// Map legacy/invalid categories to valid ones
const CATEGORY_MAP: Record<string, string> = {
  'PROMOTIONAL': 'MARKETING',
  'TRANSACTIONAL': 'UTILITY',
  'SERVICE': 'UTILITY',
  'OTP': 'AUTHENTICATION',
};

const SUPPORTED_LANGUAGES: Record<string, string> = {
  'en': 'English',
  'en_US': 'English (US)',
  'hi': 'Hindi',
};

const TemplateSchema = new Schema<ITemplateDocument, ITemplateModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  name: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true,
    match: [/^[a-z0-9_]+$/, 'Template name can only contain lowercase letters, numbers, and underscores'] 
  },
  displayName: { type: String, trim: true },
  language: { type: String, default: 'en' },
  category: { 
    type: String, 
    enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'], 
    required: true, 
    default: 'MARKETING' 
  },

  header: {
    enabled: { type: Boolean, default: false },
    format: { type: String, enum: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'], default: 'NONE' },
    text: { type: String, maxlength: 60 },
    mediaUrl: { type: String },
    mediaHandle: { type: String },
    mediaThumbnail: { type: String },
    variables: [String],
    example: { type: String }
  },

  body: {
    text: { type: String, required: true, maxlength: 1024 },
    variables: [String],
    examples: [String]
  },

  footer: {
    enabled: { type: Boolean, default: false },
    text: { type: String, maxlength: 60 }
  },

  buttons: {
    enabled: { type: Boolean, default: false },
    items: [{
      type: { type: String, enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'OTP', 'CATALOG', 'FLOW'], required: true },
      text: { type: String, required: true, maxlength: 25 },
      url: { type: String },
      urlSuffix: { type: String },
      phoneNumber: { type: String },
      otp_type: { type: String },
      example: { type: String },
      flowId: { type: String },
      navigateScreen: { type: String },
      flowAction: { type: String }
    }]
  },

  components: { type: [Schema.Types.Mixed as any], default: [] },

  templateType: { type: String, enum: ['STANDARD', 'CAROUSEL', 'LTO'], default: 'STANDARD' },
  lto: {
    enabled: { type: Boolean, default: false },
    hasExpiration: { type: Boolean, default: false },
    expirationTimeMs: { type: Number }
  },

  carousel: {
    cards: [{
      headerFormat: { type: String, enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' },
      mediaUrl: { type: String },
      mediaHandle: { type: String },
      bodyText: { type: String, maxlength: 160 },
      buttons: [{
        type: { type: String, enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'] },
        text: { type: String, maxlength: 25 },
        url: { type: String },
        phoneNumber: { type: String }
      }]
    }]
  },

  metaTemplateId: { type: String },
  providerId: { type: String },
  metaTemplateName: { type: String },
  partnerAppId: { type: String, trim: true, sparse: true, index: true },
  submittedVia: { type: String, enum: ['BSP', 'DIRECT', 'MANUAL', null], default: null },

  status: { type: String, default: 'DRAFT', index: true },
  rejectionReason: { type: String },
  rejectionDetails: {
    reason: { type: String },
    code: { type: String },
    description: { type: String },
    timestamp: { type: Date }
  },

  approvalHistory: [new Schema({
    status: { type: String, required: true },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now },
    metaEventId: { type: String },
    rawEvent: { type: Schema.Types.Mixed }
  }, { _id: false })],

  editHistory: [new Schema({
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    sourceTemplateId: { type: Schema.Types.ObjectId, ref: 'Template' },
    details: { type: Schema.Types.Mixed }
  }, { _id: false })],

  qualityScore: { type: String, enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'], default: 'UNKNOWN' },
  parameterFormat: { type: String, enum: ['POSITIONAL', 'NAMED'], default: 'POSITIONAL' },

  variables: [String],
  variableCount: { type: Number, default: 0 },

  headerText: { type: String },
  bodyText: { type: String },
  footerText: { type: String },
  buttonLabels: [String],
  preview: { type: String },

  version: { type: Number, default: 1 },
  lastEditedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  lastEditedAt: { type: Date },

  originalTemplateId: { type: Schema.Types.ObjectId, ref: 'Template' },
  isActiveVersion: { type: Boolean, default: true },

  metaPayloadSnapshot: {
    components: { type: [Schema.Types.Mixed as any] },
    name: { type: String },
    language: { type: String },
    category: { type: String },
    submittedAt: { type: Date },
    raw: { type: Schema.Types.Mixed }
  },

  usedInCampaigns: { type: Number, default: 0 },
  lastUsedAt: { type: Date },

  lastWebhookUpdate: { type: Date },
  lastWebhookEventId: { type: String },

  source: { type: String, enum: ['META', 'LOCAL', 'BSP'], default: 'LOCAL' },
  duplicatedFrom: { type: Schema.Types.ObjectId, ref: 'Template' },

  lastSyncedAt: { type: Date },
  submittedAt: { type: Date },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
TemplateSchema.index({ workspace: 1, name: 1 }, { unique: true });
TemplateSchema.index({ workspace: 1, status: 1 });
TemplateSchema.index({ workspace: 1, category: 1 });
TemplateSchema.index({ metaTemplateName: 1 }, { sparse: true });
TemplateSchema.index({ metaTemplateId: 1 }, { sparse: true });
TemplateSchema.index({ createdAt: -1 });

// Middleware
TemplateSchema.pre<ITemplateDocument>('save', function () {
  this.updatedAt = new Date();

  // Extract variables
  if (this.body?.text) {
    const vars = this.body.text.match(/\{\{(\d+)\}\}/g) || [];
    this.body.variables = vars.map(v => v.replace(/[{}]/g, ''));
  }

  const allVars = new Set([
     ...(this.header?.variables || []),
     ...(this.body?.variables || [])
  ]);
  this.variables = Array.from(allVars).sort();
  this.variableCount = this.variables.length;

  // Sync IDs
  if (this.metaTemplateId && !this.providerId) this.providerId = this.metaTemplateId;
  
  // Build Preview
  this.preview = `${this.header?.text || ''}\n${this.body.text}\n${this.footer?.text || ''}`;
});

// Statics
TemplateSchema.statics.getValidMetaCategory = function (category: string) {
  if (VALID_META_CATEGORIES.includes(category)) return category;
  return CATEGORY_MAP[category] || 'MARKETING';
};

TemplateSchema.statics.getSupportedLanguages = function () {
  return SUPPORTED_LANGUAGES;
};

TemplateSchema.statics.requireApprovedTemplate = async function (templateId: Types.ObjectId, workspaceId: Types.ObjectId) {
  const template = await this.findOne({ _id: templateId, workspace: workspaceId });
  if (!template) throw new Error('TEMPLATE_NOT_FOUND');
  if (template.status !== 'APPROVED') throw new Error(`TEMPLATE_STATUS_${template.status}`);
  return template;
};

TemplateSchema.statics.mapToGupshupComponents = function(template: ITemplate): any[] {
  const components: any[] = [];

  // 1. Header Component
  if (template.header?.enabled && template.header.format !== 'NONE') {
    const header: any = {
      type: 'HEADER',
      format: template.header.format,
    };

    if (template.header.format === 'TEXT' && template.header.text) {
      header.text = template.header.text;
      // Inject example if variables exist
      const vars = template.header.text.match(/{{(\d+)}}/g);
      if (vars && template.header.example) {
        header.example = { header_text: [template.header.example] };
      }
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.header.format)) {
      // For media, Gupshup requires a handle or URL in example
      if (template.header.mediaHandle) {
        header.example = { header_handle: [template.header.mediaHandle] };
      } else if (template.header.mediaUrl) {
        header.example = { header_url: [template.header.mediaUrl] };
      }
    }
    components.push(header);
  }

  // 2. Body Component
  if (template.body?.text) {
    const body: any = {
      type: 'BODY',
      text: template.body.text
    };

    // Handle variables
    const vars = template.body.text.match(/{{(\d+)}}/g);
    if (vars && template.body.examples && template.body.examples.length > 0) {
      body.example = { body_text: [template.body.examples] };
    }
    components.push(body);
  }

  // 3. Footer Component
  if (template.footer?.enabled && template.footer.text) {
    components.push({
      type: 'FOOTER',
      text: template.footer.text
    });
  }

  // 4. Buttons Component
  if (template.buttons?.enabled && template.buttons.items && template.buttons.items.length > 0) {
    const buttons = template.buttons.items.map(btn => {
      const b: any = {
        type: btn.type,
        text: btn.text
      };
      if (btn.type === 'URL' && btn.url) {
        b.url = btn.url;
      } else if (btn.type === 'PHONE_NUMBER' && btn.phoneNumber) {
        b.phone_number = btn.phoneNumber;
      } else if (btn.type === 'FLOW' && btn.flowId) {
        b.flow_id = btn.flowId;
        b.flow_action = btn.flowAction || 'navigate';
        b.navigate_screen = btn.navigateScreen || 'SUCCESS';
      } else if (btn.type === 'COPY_CODE') {
        b.example = btn.example;
      } else if (btn.type === 'CATALOG') {
        // Gupshup/Meta base catalog button has no extra params
      }
      return b;
    });
    components.push({
      type: 'BUTTONS',
      buttons
    });
  }

  return components;
};

/**
 * Build carousel-specific payload for Gupshup Partner API.
 * Gupshup endpoints:
 *   POST /partner/app/{appId}/templates-carouselimage
 *   POST /partner/app/{appId}/templates-carouselvideo
 * 
 * The cardList is an array of cards, each with header, body, and buttons.
 */
TemplateSchema.statics.buildCarouselPayload = function(template: ITemplate): any {
  if (template.templateType !== 'CAROUSEL' || !template.carousel?.cards?.length) {
    return null;
  }

  const cardList = template.carousel.cards.map(card => ({
    header: {
      format: card.headerFormat,
      ...(card.mediaHandle ? { handle: card.mediaHandle } : {}),
      ...(card.mediaUrl && !card.mediaHandle ? { url: card.mediaUrl } : {})
    },
    body: card.bodyText,
    buttons: card.buttons.map(btn => {
      const b: any = { type: btn.type, text: btn.text };
      if (btn.type === 'URL' && btn.url) b.url = btn.url;
      if (btn.type === 'PHONE_NUMBER' && btn.phoneNumber) b.phone_number = btn.phoneNumber;
      return b;
    })
  }));

  // Determine if it's image or video based on the first card
  const mediaType = template.carousel.cards[0]?.headerFormat || 'IMAGE';

  return {
    elementName: template.name,
    languageCode: template.language,
    category: template.category,
    templateType: 'CAROUSEL',
    body: template.body?.text || '',
    cardList,
    mediaType // 'IMAGE' or 'VIDEO' — determines which Gupshup endpoint to use
  };
};

export const Template = (mongoose.models.Template as ITemplateModel) || mongoose.model<ITemplateDocument, ITemplateModel>('Template', TemplateSchema);
