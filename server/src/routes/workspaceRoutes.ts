import { Router } from 'express';
import { workspaceController } from '../controllers/workspaceController';
import { authenticate, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/pricing', workspaceController.getPricing);

router.get('/settings', workspaceController.getSettings);
router.patch('/settings', authorizeRole(['owner', 'admin']), workspaceController.updateSettings);
router.patch('/business-info', authorizeRole(['owner', 'admin']), workspaceController.updateBusinessInfo);

router.get('/waba', workspaceController.getWABASettings);
router.get('/settings/waba', workspaceController.getWABASettings);
router.get('/waba/subscriptions/status', workspaceController.getWABASubscriptionStatus);
router.get('/whatsapp/subscriptions/status', workspaceController.getWABASubscriptionStatus);
router.get('/whatsapp/subscriptions', authorizeRole(['owner', 'admin', 'manager', 'super_admin']), workspaceController.listWebhooks);
router.post('/whatsapp/subscriptions', authorizeRole(['owner', 'admin', 'super_admin']), workspaceController.createWebhook);
router.post('/waba/test', authorizeRole(['owner', 'admin']), workspaceController.testWabaConnection);
router.post('/settings/waba/test', authorizeRole(['owner', 'admin']), workspaceController.testWabaConnection);
router.patch('/waba', authorizeRole(['owner', 'admin']), workspaceController.updateWABASettings);
router.patch('/settings/waba', authorizeRole(['owner', 'admin']), workspaceController.updateWABASettings);

router.get('/tags', workspaceController.listTags);
router.get('/settings/tags', workspaceController.listTags);
router.post('/tags', authorizeRole(['owner', 'admin', 'agent']), workspaceController.createTag);
router.post('/settings/tags', authorizeRole(['owner', 'admin', 'agent']), workspaceController.createTag);
router.delete('/tags/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteTag);
router.delete('/settings/tags/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteTag);

router.get('/quick-replies', workspaceController.listQuickReplies);
router.post('/quick-replies', authorizeRole(['owner', 'admin', 'agent']), workspaceController.saveQuickReply);
router.delete('/quick-replies/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteQuickReply);

router.get('/team', workspaceController.listTeams);
router.get('/members', workspaceController.listTeam);
router.get('/team/members', workspaceController.listTeam);
router.get(
  '/team/search',
  authorizeRole(['owner', 'admin', 'manager']),
  workspaceController.searchTeamMemberByEmail
);
router.post('/members/invite', authorizeRole(['owner', 'admin']), workspaceController.inviteMember);
router.get(
  '/members/:memberId/permissions',
  authorizeRole(['owner', 'admin']),
  workspaceController.getMemberPermissions
);
router.get('/members/:memberId', authorizeRole(['owner', 'admin', 'manager']), workspaceController.getMemberRecord);
router.patch(
  '/members/:memberId/permissions',
  authorizeRole(['owner', 'admin']),
  workspaceController.updateMemberPermissions
);
router.get(
  '/team/members/:memberId/permissions',
  authorizeRole(['owner', 'admin']),
  workspaceController.getMemberPermissions
);
router.get('/team/members/:memberId', authorizeRole(['owner', 'admin', 'manager']), workspaceController.getMemberRecord);
router.patch(
  '/team/members/:memberId/permissions',
  authorizeRole(['owner', 'admin']),
  workspaceController.updateMemberPermissions
);
router.patch(
  '/members/:memberId/role',
  authorizeRole(['owner', 'admin']),
  workspaceController.updateMemberRoleQuick
);
router.patch(
  '/team/members/:memberId/role',
  authorizeRole(['owner', 'admin']),
  workspaceController.updateMemberRoleQuick
);
router.patch('/members/:memberId', authorizeRole(['owner', 'admin']), workspaceController.updateMemberRecord);
router.delete('/members/:memberId', authorizeRole(['owner', 'admin']), workspaceController.removeMember);
router.patch('/team/members/:memberId', authorizeRole(['owner', 'admin']), workspaceController.updateMemberRecord);
router.delete('/team/members/:memberId', authorizeRole(['owner', 'admin']), workspaceController.removeMember);
router.post('/members/:invitationId/resend', authorizeRole(['owner', 'admin']), workspaceController.resendInvitation);
router.post('/team/members/:invitationId/resend', authorizeRole(['owner', 'admin']), workspaceController.resendInvitation);
router.get('/team/permissions', workspaceController.getPermissionsMatrix);
router.patch('/team/permissions', authorizeRole(['owner', 'admin']), (_req, res) => {
  res.status(501).json({ success: false, error: 'Dynamic role permission editing is not yet implemented' });
});
router.get('/team/roles', workspaceController.getRoles);
router.post('/team/roles', authorizeRole(['owner', 'admin']), workspaceController.createCustomRole);
router.get('/team/roles/:id', authorizeRole(['owner', 'admin', 'manager']), workspaceController.getRoleRecord);
router.patch('/team/roles/:id', authorizeRole(['owner', 'admin']), workspaceController.updateCustomRole);
router.delete('/team/roles/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteCustomRole);
router.get('/team/:id', authorizeRole(['owner', 'admin', 'manager']), workspaceController.getTeamRecord);
router.patch('/team/:id', authorizeRole(['owner', 'admin']), workspaceController.updateTeamRecord);
router.delete('/team/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteTeam);
router.post('/switch', workspaceController.switchWorkspace);

// WABA Profile (Frontend expects /workspace/profile)
router.get('/profile', workspaceController.getProfile);
router.get('/whatsapp/profile', workspaceController.getProfile);
router.patch('/profile', workspaceController.updateProfile);
router.patch('/whatsapp/profile', workspaceController.updateProfile);
router.post('/profile/sync', workspaceController.syncProfile);
router.post('/whatsapp/profile', workspaceController.syncProfile);
router.patch('/profile/display-name', workspaceController.updateDisplayName);
router.patch('/whatsapp/profile/display-name', workspaceController.updateDisplayName);
router.get('/whatsapp/health', workspaceController.getWhatsappHealth);

// Billing & Plans
router.get('/billing', workspaceController.getBillingSummary);
router.get('/billing/info', workspaceController.getBillingSummary);
router.get('/billing/plan', workspaceController.getPlans);
router.post('/billing/plan', workspaceController.switchPlan);
router.post('/billing/plan/verify', workspaceController.verifyPlanUpgrade);
router.patch('/billing/settings', workspaceController.updateBillingSettings);

// Recharge & Payment Method
router.post('/billing/recharge', workspaceController.initiateRecharge);
router.post('/billing/recharge/verify', workspaceController.verifyRecharge);
router.post('/billing/payment-method', workspaceController.initiatePaymentMethod);
router.post('/billing/payment-method/verify', workspaceController.verifyPaymentMethod);

// Inbox Settings
router.get('/inbox-settings', workspaceController.getInboxSettings);
router.patch('/inbox-settings', authorizeRole(['owner', 'admin']), workspaceController.updateInboxSettings);

// Roles & Teams
router.get('/roles/matrix', workspaceController.getPermissionsMatrix);
router.get('/roles', workspaceController.getRoles);
router.post('/roles', authorizeRole(['owner', 'admin']), workspaceController.createCustomRole);
router.get('/roles/:id', authorizeRole(['owner', 'admin', 'manager']), workspaceController.getRoleRecord);
router.patch('/roles/:id', authorizeRole(['owner', 'admin']), workspaceController.updateCustomRole);
router.delete('/roles/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteCustomRole);
router.get('/teams', workspaceController.listTeams);
router.post('/teams', authorizeRole(['owner', 'admin']), workspaceController.createTeamRecord);
router.get('/teams/:id', authorizeRole(['owner', 'admin', 'manager']), workspaceController.getTeamRecord);
router.patch('/teams/:id', authorizeRole(['owner', 'admin']), workspaceController.updateTeamRecord);
router.delete('/teams/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteTeam);

router.get('/webhooks', authorizeRole(['owner', 'admin']), workspaceController.listWebhooks);
router.post('/webhooks', authorizeRole(['owner', 'admin']), workspaceController.createWebhook);
router.patch('/webhooks/:id', authorizeRole(['owner', 'admin']), workspaceController.updateWebhookRecord);
router.delete('/webhooks/:id', authorizeRole(['owner', 'admin']), workspaceController.deleteWebhookRecord);

// Developer
router.get('/developer', workspaceController.getDeveloperSettings);
router.patch('/developer', authorizeRole(['owner', 'admin']), workspaceController.updateDeveloperSettings);
router.get('/developer/keys', workspaceController.getApiKeys);
router.post('/developer/keys', authorizeRole(['owner', 'admin']), workspaceController.createApiKey);
router.delete('/developer/keys/:id', authorizeRole(['owner', 'admin']), workspaceController.revokeApiKey);

export default router;
