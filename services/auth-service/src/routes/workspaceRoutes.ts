import { Router } from 'express';
import {
  getWorkspaces,
  switchWorkspace,
  getPendingInvitations,
  getWorkspaceSettings,
  updateWorkspaceSettings,
  updateWorkspaceBusinessInfo,
  getInboxSettings,
  updateInboxSettings
} from '../controllers/workspaceController.js';
import { businessAuthMiddleware } from '../middleware/businessAuth.js';

const router = Router();

router.get('/workspaces', getWorkspaces);
router.post('/switch-workspace', switchWorkspace);
// Monolith alias: POST /workspace/switch
router.post('/switch', switchWorkspace);
router.get('/invitations/pending', getPendingInvitations);

router.get('/settings', businessAuthMiddleware, getWorkspaceSettings);
router.patch('/settings', businessAuthMiddleware, updateWorkspaceSettings);
router.patch('/business-info', businessAuthMiddleware, updateWorkspaceBusinessInfo);

// Inbox / chat-assignment settings (frontend: /workspace/inbox-settings)
router.get('/inbox-settings', businessAuthMiddleware, getInboxSettings);
router.patch('/inbox-settings', businessAuthMiddleware, updateInboxSettings);
// Alias matching the gateway's /api/v1/inbox/settings -> /workspace/inbox/settings mapping
router.get('/inbox/settings', businessAuthMiddleware, getInboxSettings);
router.patch('/inbox/settings', businessAuthMiddleware, updateInboxSettings);

export default router;
