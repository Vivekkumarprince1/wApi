import { Router } from 'express';
import { commerceController } from '../controllers/commerceController';
import { authenticateOrInternal } from '../middleware/auth';

const router = Router();

router.get('/orders/:orderId', authenticateOrInternal, commerceController.getOrderById);

// Checkout payment endpoints are invoked by the monolith using the internal
// service secret (no end-user JWT during WhatsApp bot checkout). Authenticated
// gateway users still work via `authenticateOrInternal`.
router.post('/:orderId/pay', authenticateOrInternal, commerceController.initializePayment);
router.get('/:orderId/status', authenticateOrInternal, commerceController.getOrderStatus);

// Management routes — also accept internal service callers (campaign /
// monolith) via the shared secret.
router.get('/wallets/:workspaceId/orders', authenticateOrInternal, commerceController.listOrders);
router.post('/wallets/:workspaceId/orders', authenticateOrInternal, commerceController.createOrder);
router.patch('/orders/:orderId', authenticateOrInternal, commerceController.updateOrder);

export default router;
