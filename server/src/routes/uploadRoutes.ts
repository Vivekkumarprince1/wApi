import { Router } from 'express';
// @ts-ignore
import multer from 'multer';
import { uploadController } from '../controllers/uploadController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/media', authenticate, upload.single('file'), uploadController.uploadMedia);

export default router;
