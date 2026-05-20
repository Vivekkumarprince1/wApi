import { Router } from 'express';
import { internalController } from '../controllers/internalController';
import { internalAuth } from '../middlewares/internalAuth';

const router = Router();

// All routes here require the internal service secret
router.use(internalAuth);

/**
 * @route POST /api/internal/worker-bridge
 * @desc Bridge for campaign service to call monolith actions
 */
router.post('/worker-bridge', internalController.workerBridge);

/**
 * @route POST /api/internal/actions
 * @desc Endpoint for automation service to trigger monolith actions
 */
router.post('/actions', internalController.executeAction);

/**
 * @route POST /api/internal/conversations/metadata
 * @desc Update conversation metadata from automation service
 */
router.post('/conversations/metadata', internalController.updateConversationMetadata);

/**
 * @route POST /api/internal/checkout/process
 * @desc Process checkout bot message from automation service
 */
router.post('/checkout/process', internalController.processCheckout);

/**
 * @route POST /api/internal/bsp/sync-esb-flow
 * @desc Sync ESB flow status from BSP service to workspace cache
 */
router.post('/bsp/sync-esb-flow', internalController.syncEsbFlow);

/**
 * @route POST /api/internal/bsp/sync-app-cache
 * @desc Sync BSP app cache fields from bsp-service to workspace
 */
router.post('/bsp/sync-app-cache', internalController.syncBspAppCache);

export default router;
