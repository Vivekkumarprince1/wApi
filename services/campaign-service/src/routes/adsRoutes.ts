import { Router } from 'express';
import { adsController } from '../controllers/adsController';
import { authenticate } from '../middleware/auth';

const router = Router();

const paths = ['', '/api/v1/ads'];

for (const p of paths) {
  router.get(`${p}/`, authenticate, adsController.listAds);
  router.post(`${p}/`, authenticate, adsController.createAd);
  router.get(`${p}/meta/readiness`, authenticate, adsController.getMetaAdsReadiness);
  router.post(`${p}/meta/sync-all`, authenticate, adsController.syncAllMetaAds);
  router.post(`${p}/:id/publish`, authenticate, adsController.publishAd);
  router.post(`${p}/:id/status`, authenticate, adsController.updateMetaAdStatus);
  router.get(`${p}/:id/preview`, authenticate, adsController.getMetaAdPreview);
  router.post(`${p}/:id/sync`, authenticate, adsController.syncMetaAd);
  router.get(`${p}/:id`, authenticate, adsController.getAd);
  router.put(`${p}/:id`, authenticate, adsController.updateAd);
  router.delete(`${p}/:id`, authenticate, adsController.deleteAd);
}

export default router;
