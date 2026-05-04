import { Router } from 'express';
import { commerceController } from '../controllers/commerceController';

const router = Router();

router.post('/:orderId/pay', commerceController.initializePayment);
router.get('/:orderId/status', commerceController.getOrderStatus);

// Management routes
router.get('/wallets/:workspaceId/orders', commerceController.listOrders);
router.post('/wallets/:workspaceId/orders', commerceController.createOrder);
router.patch('/orders/:orderId', commerceController.updateOrder);

export default router;
