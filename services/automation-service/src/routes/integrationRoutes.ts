import { Router } from 'express';
import { integrationController } from '../controllers/integrationController';
import { authenticate, internalAuth } from '../middleware/auth';

const router = Router();

const paths = ['', '/api/v1/integrations'];

for (const p of paths) {
  router.get(`${p}/`, authenticate, integrationController.listIntegrations);
  router.post(`${p}/connect`, authenticate, integrationController.connect);
  router.post(`${p}/connect/:type`, authenticate, integrationController.connect);
  router.delete(`${p}/:id`, authenticate, integrationController.disconnect);
  router.post(`${p}/:type/sync`, authenticate, integrationController.syncIntegration);

  // Google Sheets specifics
  router.get(`${p}/google/spreadsheets`, authenticate, integrationController.listGoogleSpreadsheets);
  router.get(`${p}/google/status`, authenticate, integrationController.getGoogleStatus);
  router.get(`${p}/google/config`, authenticate, integrationController.getGoogleConfig);
  router.post(`${p}/google/config`, authenticate, integrationController.saveGoogleConfig);
  router.get(`${p}/google/sheets`, authenticate, integrationController.listGoogleSheets);
  router.get(`${p}/google/columns/:id`, authenticate, integrationController.listGoogleColumns);
  // Aliases used by customer-portal (spreadsheet id in the path)
  router.get(`${p}/google/spreadsheets/:id/sheets`, authenticate, integrationController.listGoogleSheets);
  router.get(`${p}/google/spreadsheets/:id/columns`, authenticate, integrationController.listGoogleColumns);
  router.get(`${p}/google/auth-url`, authenticate, integrationController.getGoogleAuthUrl);
  router.get(`${p}/google/callback`, authenticate, integrationController.googleCallback);

  // Instagram Business specifics
  router.get(`${p}/instagram/status`, authenticate, integrationController.getInstagramStatus);
  router.get(`${p}/instagram/auth-url`, authenticate, integrationController.getInstagramAuthUrl);
  router.get(`${p}/instagram/callback`, integrationController.instagramCallback);
  router.post(`${p}/instagram/refresh-token`, authenticate, integrationController.refreshInstagramToken);
  router.post(`${p}/instagram/graph`, authenticate, integrationController.instagramGraph);
  router.get(`${p}/instagram/profile`, authenticate, integrationController.getInstagramProfile);
  router.get(`${p}/instagram/media`, authenticate, integrationController.listInstagramMedia);
  router.post(`${p}/instagram/media`, authenticate, integrationController.createInstagramMediaContainer);
  router.post(`${p}/instagram/media/publish`, authenticate, integrationController.publishInstagramMedia);
  router.get(`${p}/instagram/media/publishing-limit`, authenticate, integrationController.getInstagramPublishingLimit);
  router.get(`${p}/instagram/media/:mediaId`, authenticate, integrationController.getInstagramMedia);
  router.post(`${p}/instagram/media/:mediaId/settings`, authenticate, integrationController.updateInstagramMediaSettings);
  router.delete(`${p}/instagram/media/:mediaId`, authenticate, integrationController.deleteInstagramMedia);
  router.get(`${p}/instagram/media/:mediaId/children`, authenticate, integrationController.getInstagramMediaChildren);
  router.get(`${p}/instagram/media/:mediaId/collaborators`, authenticate, integrationController.getInstagramMediaCollaborators);
  router.get(`${p}/instagram/media/:mediaId/insights`, authenticate, integrationController.getInstagramMediaInsights);
  router.get(`${p}/instagram/media/:mediaId/product-tags`, authenticate, integrationController.listInstagramProductTags);
  router.post(`${p}/instagram/media/:mediaId/product-tags`, authenticate, integrationController.updateInstagramProductTags);
  router.get(`${p}/instagram/media/:mediaId/comments`, authenticate, integrationController.listInstagramComments);
  router.post(`${p}/instagram/media/:mediaId/comments`, authenticate, integrationController.createInstagramComment);
  router.get(`${p}/instagram/comments/:commentId`, authenticate, integrationController.getInstagramComment);
  router.post(`${p}/instagram/comments/:commentId/replies`, authenticate, integrationController.replyToInstagramComment);
  router.post(`${p}/instagram/comments/:commentId/visibility`, authenticate, integrationController.updateInstagramCommentVisibility);
  router.delete(`${p}/instagram/comments/:commentId`, authenticate, integrationController.deleteInstagramComment);
  router.get(`${p}/instagram/conversations`, authenticate, integrationController.listInstagramConversations);
  router.get(`${p}/instagram/conversations/:conversationId/messages`, authenticate, integrationController.listInstagramConversationMessages);
  router.get(`${p}/instagram/messages/:messageId`, authenticate, integrationController.getInstagramMessage);
  router.post(`${p}/instagram/messages`, authenticate, integrationController.sendInstagramMessage);
  router.post(`${p}/instagram/messages/private-reply`, authenticate, integrationController.sendInstagramPrivateReply);
  router.get(`${p}/instagram/user-profile/:userId`, authenticate, integrationController.getInstagramUserProfile);
  router.get(`${p}/instagram/insights/account`, authenticate, integrationController.getInstagramAccountInsights);
  router.get(`${p}/instagram/business-discovery/:username`, authenticate, integrationController.getInstagramBusinessDiscovery);
  router.get(`${p}/instagram/hashtags/search`, authenticate, integrationController.searchInstagramHashtags);
  router.get(`${p}/instagram/hashtags/recently-searched`, authenticate, integrationController.listRecentlySearchedInstagramHashtags);
  router.get(`${p}/instagram/hashtags/:hashtagId/:edge`, authenticate, integrationController.listInstagramHashtagMedia);
  router.get(`${p}/instagram/catalogs`, authenticate, integrationController.listInstagramCatalogs);
  router.get(`${p}/instagram/catalogs/:catalogId/products`, authenticate, integrationController.searchInstagramCatalogProducts);
  router.get(`${p}/instagram/products/:productId/appeal`, authenticate, integrationController.getInstagramProductAppeal);
  router.post(`${p}/instagram/products/:productId/appeal`, authenticate, integrationController.createInstagramProductAppeal);
  router.get(`${p}/instagram/tags`, authenticate, integrationController.listInstagramTags);
  router.get(`${p}/instagram/stories`, authenticate, integrationController.listInstagramStories);
  router.get(`${p}/instagram/live-media`, authenticate, integrationController.listInstagramLiveMedia);
  router.get(`${p}/instagram/mentions/comments/:commentId`, authenticate, integrationController.getInstagramMentionedComment);
  router.get(`${p}/instagram/mentions/media/:mediaId`, authenticate, integrationController.getInstagramMentionedMedia);
  router.post(`${p}/instagram/mentions/replies`, authenticate, integrationController.replyToInstagramMention);
  router.get(`${p}/instagram/oembed`, authenticate, integrationController.getInstagramOEmbed);
  router.get(`${p}/instagram/messenger-profile`, authenticate, integrationController.getInstagramMessengerProfile);
  router.post(`${p}/instagram/messenger-profile`, authenticate, integrationController.updateInstagramMessengerProfile);

  // Meta Ads specifics
  router.get(`${p}/meta-ads/status`, authenticate, integrationController.getMetaAdsStatus);
  router.get(`${p}/meta-ads/auth-url`, authenticate, integrationController.getMetaAdsAuthUrl);
  router.get(`${p}/meta-ads/callback`, authenticate, integrationController.metaAdsCallback);
  router.post(`${p}/meta-ads/refresh-assets`, authenticate, integrationController.refreshMetaAdsAssets);
  router.post(`${p}/meta-ads/config`, authenticate, integrationController.saveMetaAdsConfig);
  router.get(`${p}/meta-ads/catalogs/:catalogId/products`, authenticate, integrationController.listMetaCatalogProducts);
  router.post(`${p}/meta-ads/catalogs/:catalogId/products/sync`, authenticate, integrationController.syncMetaCatalogProduct);
  router.post(`${p}/meta-ads/catalogs/:catalogId/product-sets`, authenticate, integrationController.createMetaProductSet);

  // Petpooja POS specifics
  router.post(`${p}/petpooja/connect`, authenticate, integrationController.connectPetpooja);
}

router.get('/internal/v1/integrations/meta-ads/:workspaceId', internalAuth, integrationController.getInternalMetaAdsConfig);

export default router;
