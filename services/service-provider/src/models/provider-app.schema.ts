import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderAppDocument = HydratedDocument<ProviderApp>;

@Schema({ timestamps: true, collection: 'bsp_apps' })
export class ProviderApp extends WorkspaceScopedModel {
  @Prop({ required: true, index: true })
  appId!: string;

  @Prop()
  businessId?: string;

  @Prop()
  appName?: string;

  @Prop({ default: 'not_started', index: true })
  status!: string;

  @Prop()
  displayPhoneNumber?: string;

  @Prop()
  phoneNumberId?: string;

  @Prop({ type: Object, default: {} })
  providerData!: Record<string, unknown>;

  // ─── Meta/WABA fields ────────────────────────────────────────
  @Prop()
  wabaId?: string;

  @Prop()
  childWabaId?: string;

  @Prop()
  metaBusinessId?: string;

  @Prop()
  businessAccountId?: string;

  @Prop({ default: false, index: true })
  whatsappConnected: boolean;

  @Prop({ select: false })
  whatsappAccessToken?: string;

  @Prop({ select: false })
  whatsappVerifyToken?: string;

  @Prop()
  connectedAt?: Date;

  @Prop()
  wabaStatus?: string;

  @Prop()
  verifiedName?: string;

  @Prop({ default: 'UNKNOWN' })
  qualityRating?: string;

  @Prop()
  messagingLimitTier?: string;

  @Prop()
  codeVerificationStatus?: string;

  @Prop()
  nameStatus?: string;

  @Prop({ default: false })
  isOfficialAccount: boolean;

  @Prop({ select: false })
  accessToken?: string;

  @Prop()
  tokenExpiresAt?: Date;

  // ─── Gupshup fields ─────────────────────────────────────────
  @Prop()
  gupshupAppId?: string;

  @Prop()
  gupshupAppName?: string;

  @Prop()
  onboardingStatus?: string;

  @Prop({ default: false })
  gupshupAppLive: boolean;

  @Prop({ type: Boolean, default: null })
  gupshupAppHealth?: boolean | null;

  @Prop()
  gupshupWalletBalance?: number;

  @Prop({ type: Object })
  gupshupRatings?: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  gupshupIdentity?: {
    partnerAppId?: string;
    appApiKey?: string;
    appApiKeyExpiresAt?: Date;
    appApiKeyRefreshedAt?: Date;
    appStatus?: 'pending' | 'created' | 'active' | 'suspended';
    source?: string;
  };

  // ─── Phone/registration fields ───────────────────────────────
  @Prop({ unique: true, sparse: true })
  bspPhoneNumberId?: string;

  @Prop()
  bspDisplayPhoneNumber?: string;

  @Prop()
  bspVerifiedName?: string;

  @Prop()
  whatsappPhoneNumberId?: string;

  @Prop()
  whatsappPhoneNumber?: string;

  @Prop({ default: 'PENDING' })
  bspPhoneStatus: string;

  @Prop({ default: 'UNKNOWN' })
  bspQualityRating: string;

  @Prop({ default: 'TIER_1K' })
  bspMessagingTier: string;

  @Prop()
  bspOnboardedAt?: Date;

  // ─── Sync & audit fields ────────────────────────────────────
  @Prop()
  bspLastSyncedAt?: Date;

  @Prop({ default: 'INACTIVE' })
  bspSyncStatus?: string;

  @Prop({ type: Object, default: {} })
  bspAudit?: {
    phoneAssignedAt?: Date;
    phoneAssignedBy?: string;
    lastStatusCheck?: Date;
    lastQualityUpdate?: Date;
    warnings?: Array<{
      type?: string;
      message?: string;
      createdAt?: Date;
    }>;
  };

  @Prop({ type: Object })
  businessProfile?: Record<string, unknown>;

  @Prop([{
    id: { type: String },
    displayPhoneNumber: { type: String },
    verifiedName: { type: String },
    qualityRating: { type: String },
    status: { type: String }
  }])
  phoneNumbers?: Array<{
    id?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    status?: string;
  }>;

  // ─── Workspace backwards-compat flags ────────────────────────
  @Prop({ default: true })
  bspManaged: boolean;

  @Prop()
  bspWabaId?: string;
}

export const ProviderAppSchema = SchemaFactory.createForClass(ProviderApp);
ProviderAppSchema.index({ workspaceId: 1, provider: 1, appId: 1 }, { unique: true });
ProviderAppSchema.index({ workspaceId: 1, gupshupAppId: 1 }, { sparse: true });
ProviderAppSchema.index({ workspaceId: 1, status: 1 });
