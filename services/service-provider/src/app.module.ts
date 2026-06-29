import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { config } from './config';
import { InternalAuthGuard } from './common/internal-auth.guard';
import { GupshupClientService } from './channels/whatsapp/providers/gupshup/gupshup-client.service';
import { AppsController } from './channels/whatsapp/apps/apps.controller';
import { AppsService } from './channels/whatsapp/apps/apps.service';
import { OnboardingController } from './channels/whatsapp/onboarding/onboarding.controller';
import { OnboardingService } from './channels/whatsapp/onboarding/onboarding.service';
import { TemplateSeedingService } from './channels/whatsapp/onboarding/template-seeding.service';
import { TokensController } from './channels/whatsapp/tokens/tokens.controller';
import { TokensService } from './channels/whatsapp/tokens/tokens.service';
import { PhonesController } from './channels/whatsapp/phones/phones.controller';
import { SubscriptionsController } from './channels/whatsapp/subscriptions/subscriptions.controller';
import { WebhookSyncService } from './channels/whatsapp/subscriptions/webhook-sync.service';
import { MessagesController } from './channels/whatsapp/messages/messages.controller';
import { MessagesService } from './channels/whatsapp/messages/messages.service';
import { TemplatesController, TemplatesPublicController } from './channels/whatsapp/templates/templates.controller';
import { MediaController } from './channels/whatsapp/media/media.controller';
import { UploadController } from './channels/whatsapp/media/upload.controller';
import { ProfilesController } from './channels/whatsapp/profiles/profiles.controller';

import { WebhooksController } from './channels/whatsapp/webhooks/webhooks.controller';
import { WebhooksService } from './channels/whatsapp/webhooks/webhooks.service';
import { HealthController } from './health/health.controller';
import { ProviderActionsController } from './channels/whatsapp/provider-actions/provider-actions.controller';
import { ProviderActionsService } from './channels/whatsapp/provider-actions/provider-actions.service';
import { EsbFlowController } from './channels/whatsapp/esb-flow/esb-flow.controller';
import { EsbFlowService } from './channels/whatsapp/esb-flow/esb-flow.service';
import { WorkspaceController, WorkspaceInternalController } from './workspace/workspace.controller';
import { WorkspaceService } from './workspace/workspace.service';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { ChannelController } from './channels/channel.controller';
import { ChannelService } from './channels/channel.service';
import { ProviderApp, ProviderAppSchema } from './models/provider-app.schema';
import { ProviderCredential, ProviderCredentialSchema } from './models/provider-credential.schema';
import { ProviderHealthSnapshot, ProviderHealthSnapshotSchema } from './models/provider-health-snapshot.schema';
import { ProviderMediaAsset, ProviderMediaAssetSchema } from './models/provider-media-asset.schema';
import { ProviderMessageDispatch, ProviderMessageDispatchSchema } from './models/provider-message-dispatch.schema';
import { ProviderOnboardingSession, ProviderOnboardingSessionSchema } from './models/provider-onboarding-session.schema';
import { ProviderProfile, ProviderProfileSchema } from './models/provider-profile.schema';
import { Provider, ProviderSchema } from './models/provider.schema';
import { ProviderSubscription, ProviderSubscriptionSchema } from './models/provider-subscription.schema';
import { ProviderTemplateMirror, ProviderTemplateMirrorSchema } from './models/provider-template-mirror.schema';
import { ProviderTemplateRule, ProviderTemplateRuleSchema } from './models/provider-template-rule.schema';
import { ProviderToken, ProviderTokenSchema } from './models/provider-token.schema';
import { ProviderWebhookEvent, ProviderWebhookEventSchema } from './models/provider-webhook-event.schema';
import { ProviderOnboardingState, ProviderOnboardingStateSchema } from './models/provider-onboarding-state.schema';
import { ProviderEsbFlow, ProviderEsbFlowSchema } from './models/provider-esb-flow.schema';

import { ProviderEventConsumerService } from './common/provider-event-consumer.service';
import { ProviderEventProducerService } from './common/provider-event-producer.service';
import { RedisService } from './common/redis.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forRoot(config.mongodbUri),
    MongooseModule.forFeature([
      { name: ProviderApp.name, schema: ProviderAppSchema },
      { name: ProviderCredential.name, schema: ProviderCredentialSchema },
      { name: ProviderHealthSnapshot.name, schema: ProviderHealthSnapshotSchema },
      { name: ProviderMediaAsset.name, schema: ProviderMediaAssetSchema },
      { name: ProviderMessageDispatch.name, schema: ProviderMessageDispatchSchema },
      { name: ProviderOnboardingSession.name, schema: ProviderOnboardingSessionSchema },
      { name: ProviderOnboardingState.name, schema: ProviderOnboardingStateSchema },
      { name: ProviderEsbFlow.name, schema: ProviderEsbFlowSchema },
      { name: ProviderProfile.name, schema: ProviderProfileSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: ProviderSubscription.name, schema: ProviderSubscriptionSchema },
      { name: ProviderTemplateMirror.name, schema: ProviderTemplateMirrorSchema },
      { name: ProviderTemplateRule.name, schema: ProviderTemplateRuleSchema },
      { name: ProviderToken.name, schema: ProviderTokenSchema },
      { name: ProviderWebhookEvent.name, schema: ProviderWebhookEventSchema },
    ]),
  ],
  controllers: [
    AppsController,
    OnboardingController,
    TokensController,
    PhonesController,
    SubscriptionsController,
    MessagesController,
    TemplatesController,
    TemplatesPublicController,
    MediaController,
    UploadController,
    ProfilesController,
    WebhooksController,
    ProviderActionsController,
    HealthController,
    EsbFlowController,
    WorkspaceController,
    WorkspaceInternalController,
    AdminController,
    ChannelController,
  ],

  providers: [
    InternalAuthGuard,
    RedisService,
    GupshupClientService,
    AppsService,
    OnboardingService,
    TemplateSeedingService,
    TokensService,
    MessagesService,
    WebhooksService,
    EsbFlowService,
    WorkspaceService,
    AdminService,
    ChannelService,
    ProviderActionsService,
    ProviderEventConsumerService,
    ProviderEventProducerService,
    WebhookSyncService,
  ],
  exports: [
    ProviderEventProducerService,
  ],
})
export class AppModule {}
