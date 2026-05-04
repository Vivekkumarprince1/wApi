/**
 * Settings Routes
 * Workspace and user settings endpoints
 */

import { Router } from 'express';
import { settingsController } from '../controllers/settingsController';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Workspace settings
router.get('/workspace', settingsController.getWorkspaceSettings);
router.patch('/workspace', authorizeRole(['owner', 'admin']), settingsController.updateWorkspaceSettings);

// Billing settings
router.get('/billing', settingsController.getBillingSettings);
router.patch('/billing', authorizeRole(['owner', 'admin']), settingsController.updateBillingSettings);

// User notification settings
router.get('/notifications', settingsController.getUserNotifications);
router.patch('/notifications', settingsController.updateUserNotifications);

// Integrations
router.get('/integrations', settingsController.getIntegrationsSettings);

// API Keys
router.get('/api-keys', settingsController.getApiKeys);
router.post('/api-keys', authorizeRole(['owner', 'admin']), settingsController.createApiKey);
router.delete('/api-keys/:keyId', authorizeRole(['owner', 'admin']), settingsController.revokeApiKey);

// Team settings
router.get('/team', settingsController.getTeamSettings);
router.patch('/team/:userId/role', authorizeRole(['owner', 'admin']), settingsController.updateTeamMemberRole);

export default router;
