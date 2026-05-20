import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { config } from './config';
import { InternalAuthGuard } from './common/internal-auth.guard';
import { GupshupClientService } from './gupshup/gupshup-client.service';
import { AppsController } from './apps/apps.controller';
import { AppsService } from './apps/apps.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { TokensController } from './tokens/tokens.controller';
import { TokensService } from './tokens/tokens.service';
import { PhonesController } from './phones/phones.controller';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { MessagesController } from './messages/messages.controller';
import { MessagesService } from './messages/messages.service';
import { TemplatesController } from './templates/templates.controller';
import { MediaController } from './media/media.controller';
import { ProfilesController } from './profiles/profiles.controller';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';
import { HealthController } from './health/health.controller';
import { ProviderActionsController } from './provider-actions/provider-actions.controller';
import { EsbFlowController } from './esb-flow/esb-flow.controller';
import { EsbFlowService } from './esb-flow/esb-flow.service';
import { WorkspaceController, WorkspaceInternalController } from './workspace/workspace.controller';
import { WorkspaceService } from './workspace/workspace.service';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { BspApp, BspAppSchema } from './models/bsp-app.schema';
import { BspCredential, BspCredentialSchema } from './models/bsp-credential.schema';
import { BspHealthSnapshot, BspHealthSnapshotSchema } from './models/bsp-health-snapshot.schema';
import { BspMediaAsset, BspMediaAssetSchema } from './models/bsp-media-asset.schema';
import { BspMessageDispatch, BspMessageDispatchSchema } from './models/bsp-message-dispatch.schema';
import { BspOnboardingSession, BspOnboardingSessionSchema } from './models/bsp-onboarding-session.schema';
import { BspProfile, BspProfileSchema } from './models/bsp-profile.schema';
import { BspProvider, BspProviderSchema } from './models/bsp-provider.schema';
import { BspSubscription, BspSubscriptionSchema } from './models/bsp-subscription.schema';
import { BspTemplateMirror, BspTemplateMirrorSchema } from './models/bsp-template-mirror.schema';
import { BspToken, BspTokenSchema } from './models/bsp-token.schema';
import { BspWebhookEvent, BspWebhookEventSchema } from './models/bsp-webhook-event.schema';
import { BspOnboardingState, BspOnboardingStateSchema } from './models/bsp-onboarding-state.schema';
import { BspEsbFlow, BspEsbFlowSchema } from './models/bsp-esb-flow.schema';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forRoot(config.mongodbUri),
    MongooseModule.forFeature([
      { name: BspApp.name, schema: BspAppSchema },
      { name: BspCredential.name, schema: BspCredentialSchema },
      { name: BspHealthSnapshot.name, schema: BspHealthSnapshotSchema },
      { name: BspMediaAsset.name, schema: BspMediaAssetSchema },
      { name: BspMessageDispatch.name, schema: BspMessageDispatchSchema },
      { name: BspOnboardingSession.name, schema: BspOnboardingSessionSchema },
      { name: BspOnboardingState.name, schema: BspOnboardingStateSchema },
      { name: BspEsbFlow.name, schema: BspEsbFlowSchema },
      { name: BspProfile.name, schema: BspProfileSchema },
      { name: BspProvider.name, schema: BspProviderSchema },
      { name: BspSubscription.name, schema: BspSubscriptionSchema },
      { name: BspTemplateMirror.name, schema: BspTemplateMirrorSchema },
      { name: BspToken.name, schema: BspTokenSchema },
      { name: BspWebhookEvent.name, schema: BspWebhookEventSchema },
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
    MediaController,
    ProfilesController,
    WebhooksController,
    ProviderActionsController,
    HealthController,
    EsbFlowController,
    WorkspaceController,
    WorkspaceInternalController,
    AdminController,
  ],
  providers: [
    InternalAuthGuard,
    GupshupClientService,
    AppsService,
    OnboardingService,
    TokensService,
    MessagesService,
    WebhooksService,
    EsbFlowService,
    WorkspaceService,
    AdminService,
  ],
})
export class AppModule {}
