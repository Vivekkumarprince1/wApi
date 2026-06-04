import { Router } from 'express';
import { adsController } from '../controllers/adsController';
import { authenticate } from '../middleware/auth';

const router = Router();

const paths = ['', '/api/v1/ads'];

for (const p of paths) {
  router.get(`${p}/`, authenticate, adsController.listAds);
  router.post(`${p}/`, authenticate, adsController.createAd);
  router.get(`${p}/:id`, authenticate, adsController.getAd);
  router.put(`${p}/:id`, authenticate, adsController.updateAd);
  router.delete(`${p}/:id`, authenticate, adsController.deleteAd);
}

export default router;
