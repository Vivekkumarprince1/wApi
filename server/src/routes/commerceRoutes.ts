import { Router } from 'express';
import { body } from 'express-validator';
import { commerceController } from '../controllers/commerceController';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { requirePermission } from '../middlewares/permissionMiddleware';

const router = Router();

router.get('/catalogs', authenticate, requirePermission('commerce.view'), commerceController.listCatalogs);
router.get('/catalogs/:catalogId/products', authenticate, requirePermission('commerce.view'), commerceController.listProducts);
router.get('/stats', authenticate, requirePermission('commerce.view'), commerceController.getStats);
router.get('/products', authenticate, requirePermission('commerce.view'), commerceController.listProducts);

router.post('/products', 
  authenticate, 
  requirePermission('commerce.manage'),
  validate([
    body('name').notEmpty().isString(),
    body('price').isNumeric(),
    body('currency').optional().isString().isLength({ min: 3, max: 3 })
  ]),
  commerceController.createProduct
);
router.put('/products/:id', authenticate, requirePermission('commerce.manage'), commerceController.updateProduct);
router.patch('/products/:id', authenticate, requirePermission('commerce.manage'), commerceController.updateProduct);
router.delete('/products/:id', authenticate, requirePermission('commerce.manage'), commerceController.deleteProduct);

router.get('/orders', authenticate, requirePermission('commerce.view'), commerceController.listOrders);
router.post('/orders', authenticate, requirePermission('commerce.manage'), commerceController.createOrder);
router.put('/orders', authenticate, requirePermission('commerce.manage'), commerceController.updateOrder);
router.patch('/orders', authenticate, requirePermission('commerce.manage'), commerceController.updateOrder);
router.get('/orders/:id', authenticate, requirePermission('commerce.view'), commerceController.getOrder);
router.patch('/orders/:id/status', authenticate, requirePermission('commerce.manage'), commerceController.updateOrderStatus);

router.post('/orders/:orderId/pay', 
  authenticate, 
  requirePermission('commerce.view'),
  commerceController.getPaymentLink
);

router.get('/settings', authenticate, requirePermission('commerce.view'), commerceController.getSettings);
router.post('/settings', authenticate, authorizeRole(['owner', 'admin']), commerceController.updateSettings);
router.patch('/settings', authenticate, authorizeRole(['owner', 'admin']), commerceController.updateSettings);
router.get('/checkout-bot/stats', authenticate, requirePermission('commerce.view'), commerceController.getCheckoutBotStats);

export default router;
