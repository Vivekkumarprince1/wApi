import { Router } from 'express';
import { 
  listTeams, 
  createTeam, 
  getTeam, 
  updateTeam, 
  deleteTeam 
} from '../controllers/teamController.js';
import { businessAuthMiddleware } from '../middleware/businessAuth.js';

const router = Router();

router.get('/workspace/teams', businessAuthMiddleware, listTeams);
router.get('/teams', businessAuthMiddleware, listTeams);
// Monolith alias: GET /workspace/team listed teams
router.get('/team', businessAuthMiddleware, listTeams);

router.post('/workspace/teams', businessAuthMiddleware, createTeam);
router.post('/teams', businessAuthMiddleware, createTeam);

router.get('/workspace/teams/:id', businessAuthMiddleware, getTeam);
router.get('/teams/:id', businessAuthMiddleware, getTeam);

router.patch('/workspace/teams/:id', businessAuthMiddleware, updateTeam);
router.patch('/teams/:id', businessAuthMiddleware, updateTeam);

router.delete('/workspace/teams/:id', businessAuthMiddleware, deleteTeam);
router.delete('/teams/:id', businessAuthMiddleware, deleteTeam);

export default router;
