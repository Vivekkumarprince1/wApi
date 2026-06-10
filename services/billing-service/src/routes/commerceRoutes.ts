import { Router } from 'express';
import { commerceController } from '../controllers/commerceController';
import { authenticateOrInternal } from '../middleware/auth';

const router = Router();

router.get('/orders/:orderId', authenticateOrInternal, commerceController.getOrderById);

// Checkout payment endpoints
router.post('/:orderId/pay', authenticateOrInternal, commerceController.initializePayment);
router.get('/:orderId/status', authenticateOrInternal, commerceController.getOrderStatus);

// Internal Management routes
router.get('/wallets/:workspaceId/orders', authenticateOrInternal, commerceController.listOrders);
router.post('/wallets/:workspaceId/orders', authenticateOrInternal, commerceController.createOrder);

// --- Product Catalog CRUD ---
router.get('/catalogs', authenticateOrInternal, commerceController.listCatalogs);
router.get('/products', authenticateOrInternal, commerceController.listProducts);
router.post('/products', authenticateOrInternal, commerceController.createProduct);
router.put('/products/:id', authenticateOrInternal, commerceController.updateProduct);
router.patch('/products/:id', authenticateOrInternal, commerceController.updateProduct);
router.delete('/products/:id', authenticateOrInternal, commerceController.deleteProduct);

// Catalog products query path mapping (used by frontend query)
router.get('/catalogs/:catalogId/products', authenticateOrInternal, commerceController.listProducts);

// Checkout Bot Stats
router.get('/checkout-bot/stats', authenticateOrInternal, commerceController.getCheckoutBotStats);

// Commerce Settings and Stats
router.get('/stats', authenticateOrInternal, commerceController.getStats);
router.get('/settings', authenticateOrInternal, commerceController.getSettings);
router.post('/settings', authenticateOrInternal, commerceController.updateSettings);
router.patch('/settings', authenticateOrInternal, commerceController.updateSettings);

// Orders CRUD matching Frontend direct calls
router.get('/orders', authenticateOrInternal, async (req: any, res) => {
  const workspaceId = req.workspace?._id?.toString() || req.headers['x-workspace-id'];
  req.params.workspaceId = workspaceId;
  return commerceController.listOrders(req, res);
});

router.post('/orders', authenticateOrInternal, async (req: any, res) => {
  const workspaceId = req.workspace?._id?.toString() || req.headers['x-workspace-id'];
  req.params.workspaceId = workspaceId;
  return commerceController.createOrder(req, res);
});

router.get('/orders/:orderId', authenticateOrInternal, commerceController.getOrderById);
router.patch('/orders/:orderId', authenticateOrInternal, commerceController.updateOrder);
router.patch('/orders/:orderId/status', authenticateOrInternal, commerceController.updateOrderStatus);

// Body-based orders update (used by frontend orders list edits)
router.patch('/orders', authenticateOrInternal, commerceController.updateOrder);
router.put('/orders', authenticateOrInternal, commerceController.updateOrder);

export default router;
