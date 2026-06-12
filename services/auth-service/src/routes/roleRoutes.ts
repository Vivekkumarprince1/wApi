import { Router } from 'express';
import {
  listRoles,
  createRole,
  getRole,
  updateRole,
  deleteRole,
  getPermissionsMatrix
} from '../controllers/roleController.js';
import { businessAuthMiddleware } from '../middleware/businessAuth.js';

const router = Router();

// NOTE: /matrix must be registered before /:id so it is not captured as an id.
router.get('/workspace/roles/matrix', businessAuthMiddleware, getPermissionsMatrix);
router.get('/roles/matrix', businessAuthMiddleware, getPermissionsMatrix);

// Monolith aliases: GET /workspace/team/permissions served the same matrix;
// PATCH was an explicit 501 (dynamic role permission editing never shipped).
router.get('/team/permissions', businessAuthMiddleware, getPermissionsMatrix);
router.patch('/team/permissions', businessAuthMiddleware, (_req, res) => {
  res.status(501).json({ success: false, error: 'Dynamic role permission editing is not yet implemented' });
});

router.get('/workspace/roles', businessAuthMiddleware, listRoles);
router.get('/roles', businessAuthMiddleware, listRoles);

router.post('/workspace/roles', businessAuthMiddleware, createRole);
router.post('/roles', businessAuthMiddleware, createRole);

router.get('/workspace/roles/:id', businessAuthMiddleware, getRole);
router.get('/roles/:id', businessAuthMiddleware, getRole);

router.patch('/workspace/roles/:id', businessAuthMiddleware, updateRole);
router.patch('/roles/:id', businessAuthMiddleware, updateRole);

router.delete('/workspace/roles/:id', businessAuthMiddleware, deleteRole);
router.delete('/roles/:id', businessAuthMiddleware, deleteRole);

export default router;
