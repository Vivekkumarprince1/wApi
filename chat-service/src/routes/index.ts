import { Router } from 'express';
import chatRoutes from './chatRoutes.js';
import supportRoutes from './supportRoutes.js';

const router = Router();

router.use('/', chatRoutes);
router.use('/', supportRoutes);

export default router;
