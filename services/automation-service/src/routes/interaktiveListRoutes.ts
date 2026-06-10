import { Router } from 'express';
import * as InteraktiveListController from '../controllers/InteraktiveListController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/interaktive-list', authenticate, InteraktiveListController.getLists);
router.get('/interaktive-list/:id', authenticate, InteraktiveListController.getListById);
router.post('/interaktive-list', authenticate, InteraktiveListController.createList);
router.patch('/interaktive-list/:id', authenticate, InteraktiveListController.updateList);
router.put('/interaktive-list/:id', authenticate, InteraktiveListController.updateList);
router.delete('/interaktive-list/:id', authenticate, InteraktiveListController.deleteList);

export default router;
