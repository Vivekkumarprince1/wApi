const express = require('express');
const auth = require('../../middlewares/auth');
const teamController = require('../../controllers/workspace/teamController');

const router = express.Router();

// ══════════════════════════════════════
// MIDDLEWARE: Role-based access
// ══════════════════════════════════════

// Only owners, admins, and managers can manage team
const canManageTeam = (req, res, next) => {
  const allowedRoles = ['owner', 'admin', 'manager'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to manage the team'
    });
  }
  next();
};

router.use(auth);

// ══════════════════════════════════════
// AGENT MEMBERS (Interakt: Agent Settings)
// ══════════════════════════════════════

// List all workspace agents (any role)
router.get('/members', teamController.listTeamMembers);

// Create agent / Invite (admin+)
router.post('/invite', canManageTeam, teamController.inviteTeamMember);

// Edit agent profile (name, phone, role) (admin+)
router.put('/members/:memberId', canManageTeam, teamController.updateMember);

// Change role shortcut (admin+)
router.put('/members/:memberId/role', canManageTeam, teamController.updateMemberRole);

// Update agent assignment settings (admin+)
router.put('/members/:memberId/settings', canManageTeam, teamController.updateMemberSettings);

// Get agent stats (admin+ or self)
router.get('/members/:memberId/stats', teamController.getMemberStats);

// Remove agent (admin+)
router.delete('/members/:memberId', canManageTeam, teamController.removeTeamMember);

// ══════════════════════════════════════
// SELF-SERVICE (any authenticated user)
// ══════════════════════════════════════

// Toggle own availability (agents toggle themselves)
router.put('/availability', teamController.toggleAvailability);

// ══════════════════════════════════════
// ROLES & PERMISSIONS (Interakt: Permissions)
// ══════════════════════════════════════

router.get('/permissions', teamController.getPermissionsMatrix);

// ══════════════════════════════════════
// TEAMS / GROUPS (Interakt: Manage Teams)
// ══════════════════════════════════════

router.get('/teams', teamController.listTeams);
router.post('/teams', canManageTeam, teamController.createTeam);
router.put('/teams/:teamId', canManageTeam, teamController.updateTeam);
router.delete('/teams/:teamId', canManageTeam, teamController.deleteTeam);

// ══════════════════════════════════════
// AUTO-ASSIGN ENGINE
// ══════════════════════════════════════

router.post('/auto-assign', canManageTeam, teamController.autoAssignConversation);

module.exports = router;
