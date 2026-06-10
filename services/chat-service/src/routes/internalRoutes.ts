import { Router, Request, Response, NextFunction } from 'express';
import { internalController } from '../controllers/internalController.js';

const router = Router();

// Internal service auth check middleware
const internalAuth = (req: Request, res: Response, next: NextFunction) => {
  const provided = req.header('x-internal-service-secret');
  const expected = process.env.INTERNAL_SERVICE_SECRET!;

  if (!provided || provided !== expected) {
    console.warn(`[Chat InternalAuth] Rejecting unauthorized access from ${req.ip} to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ success: false, message: 'Unauthorized: Internal service secret missing or invalid' });
  }
  next();
};

// All internal routes require service key authentication
router.use(internalAuth);

/**
 * @route POST /api/internal/worker-bridge
 * @desc Bridge for campaign service to call actions
 */
router.post('/worker-bridge', internalController.workerBridge);

/**
 * @route POST /api/internal/actions
 * @desc Endpoint for automation service to trigger actions
 */
router.post('/actions', internalController.executeAction);

/**
 * @route POST /api/internal/conversations/metadata
 * @desc Update conversation metadata
 */
router.post('/conversations/metadata', internalController.updateConversationMetadata);

/**
 * @route POST /api/internal/checkout/process
 * @desc Process checkout bot message from automation service
 */
router.post('/checkout/process', internalController.processCheckout);

/**
 * @route POST /api/internal/dlq/replay
 * @desc Replay messages from a Kafka DLQ topic back to its primary topic
 */
router.post('/dlq/replay', internalController.replayDlq);

export default router;
