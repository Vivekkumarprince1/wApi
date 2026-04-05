const express = require('express');
const auth = require('../../middlewares/auth');
const teamController = require('../../controllers/workspace/teamController');

const router = express.Router();

// Role check: Only owners, admins, and managers can manage team
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

// Publicly available (to team members)
router.get('/members', teamController.listTeamMembers);

// Restricted to managers/owners
router.post('/invite', canManageTeam, teamController.inviteTeamMember);
router.put('/members/:memberId/role', canManageTeam, teamController.updateMemberRole);
router.put('/members/:memberId/settings', canManageTeam, teamController.updateMemberSettings);
router.delete('/members/:memberId', canManageTeam, teamController.removeTeamMember);
router.get('/permissions', teamController.getPermissionsMatrix);

module.exports = router;
