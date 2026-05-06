import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { authenticate, isSuperAdmin } from '../middlewares/authMiddleware';

const router = Router();

// All routes here require Super Admin role
router.use(authenticate, isSuperAdmin);

router.get('/workspaces', adminController.listWorkspaces);
router.get('/workspaces/:id', adminController.getWorkspace);
router.get('/users', adminController.listUsers);
router.post('/users/invite', adminController.inviteUser);
router.patch('/users/:id/role', adminController.updateUserRole);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);
router.get('/stats', adminController.getStats);
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);
router.get('/compliance-profile', adminController.getComplianceProfile);
router.patch('/compliance-profile', adminController.updateComplianceProfile);
router.get('/health', adminController.health);
router.get('/control-plane', adminController.getControlPlane);
router.get('/audit-log', adminController.getAuditLogs);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/whatsapp-requests', adminController.listWhatsAppRequests);
router.post('/actions', adminController.executeAction);
router.post('/stop-impersonating', adminController.stopImpersonating);

// Data Explorer
router.get('/data/collections', adminController.listCollections);
router.get('/data/collections/:collectionName', adminController.fetchDocuments);
router.patch('/data/collections/:collectionName/:id', adminController.updateDocument);

// Infrastructure monitoring
router.get('/infrastructure', adminController.getInfrastructure);

// Plans
router.get('/plans', adminController.listPlans);
router.get('/plans/:id', adminController.getPlan);
router.post('/plans', adminController.createPlan);
router.post('/plans/seed', adminController.seedPlans);
router.patch('/plans/:id', adminController.updatePlan);
router.delete('/plans/:id', adminController.deletePlan);

// Gupshup Admin
router.post('/gupshup/reconcile', adminController.reconcileGupshup);
router.post('/gupshup/apps/reconcile', adminController.reconcileGupshup);
router.post('/gupshup/dashboards/reconcile', adminController.reconcileGupshup);
router.get('/gupshup/health', adminController.gupshupHealth);
router.get('/gupshup/webhook-audit', adminController.getAuditLogs);
router.get('/gupshup/developer-config', adminController.getGupshupDeveloperConfig);
router.patch('/gupshup/developer-config', adminController.patchGupshupDeveloperConfig);

// Webhook Policies
router.get('/gupshup/webhook-policies', adminController.getWebhookPolicies);
router.post('/gupshup/webhook-policies', adminController.saveWebhookPolicy);

// Workspace specific
router.post('/workspaces/:id/impersonate', adminController.impersonateWorkspace);
router.delete('/workspaces/:id', adminController.deleteWorkspace);
router.patch('/workspaces/:id/plan', adminController.updateWorkspacePlan);

router.get('/billing-stats', adminController.billingStats);
router.get('/invoices', adminController.listInvoices);
router.post('/billing/reconcile', adminController.reconcileBilling);
router.get('/billing/*', (req, res, next) => adminController.billingStats(req as any, res, next));

// Repair & Audit
router.get('/entitlements/drift', adminController.getEntitlementDrift);
router.post('/repair-subscriptions', adminController.repairSubscriptions);
router.post('/emergency-freeze', adminController.emergencyFreeze);
router.post('/security/emergency-freeze', adminController.emergencyFreeze);

router.get('/gupshup/webhook-status', adminController.getWebhookStatus);
router.post('/gupshup/sync-webhook/:appId', adminController.syncSpecificWebhook);
router.delete('/gupshup/subscription/:appId/:subscriptionId', adminController.deleteGupshupSubscription);
router.post('/gupshup/sync-all-webhooks', adminController.syncGupshupWebhooks);

export default router;
