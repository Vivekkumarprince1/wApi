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
