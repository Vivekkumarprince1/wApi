import { Router } from 'express';
import contactRoutes from './contactRoutes.js';

const router = Router();

router.use('/', contactRoutes);

export default router;
