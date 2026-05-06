import { Router } from 'express';
import * as SegmentController from '../controllers/SegmentController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/segments', authenticate, SegmentController.listSegments);
router.post('/segments', authenticate, SegmentController.createSegment);
router.get('/segments/:id', authenticate, SegmentController.getSegmentById);
router.get('/segments/:id/resolve', authenticate, SegmentController.resolveSegment);
router.put('/segments/:id', authenticate, SegmentController.updateSegment);
router.delete('/segments/:id', authenticate, SegmentController.deleteSegment);

export default router;
