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
 * @route GET /api/internal/verify/user/:userId
 * @desc Verify user existence and retrieve socket-relevant details
 */
router.get('/verify/user/:userId', internalController.verifyUser);

/**
 * @route GET /api/internal/verify/workspace-member
 * @desc Verify if a user is an active member of a workspace
 */
router.get('/verify/workspace-member', internalController.verifyWorkspaceMember);

/**
 * @route GET /api/internal/verify/conversation-member
 * @desc Verify if a user can access a conversation (member of its workspace)
 */
router.get('/verify/conversation-member', internalController.verifyConversationAccess);

export default router;
