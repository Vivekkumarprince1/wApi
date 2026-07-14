import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { authenticate, authenticateOrInternal, internalAuth, authorize } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { canAccessWorkspace } from '../middleware/tenant-policy';

const router = Router();

const enforceWorkspaceParam = (req: AuthRequest, res: any, next: any) => {
	const authenticatedWorkspace = String(req.workspace?.id || req.workspace?._id || '');
	if (!canAccessWorkspace({
		requestedWorkspaceId: String(req.params.workspaceId || ''),
		authenticatedWorkspaceId: authenticatedWorkspace,
		systemRole: req.user?.role,
		workspaceRole: req.role,
	})) {
		return res.status(403).json({ success: false, error: { code: 'CROSS_TENANT_ACCESS_DENIED', message: 'Workspace does not match authenticated tenant' } });
	}
	next();
};

// ══════════════════════════════════════════════
// STATIC ROUTES (must be defined BEFORE dynamic :workspaceId routes)
// ══════════════════════════════════════════════

// Admin routes
router.get('/admin/all-invoices', authenticate, authorize(['super_admin']), WalletController.getAllInvoices);
router.get('/admin/stats', authenticate, authorize(['super_admin']), WalletController.getBillingStats);

// Plan routes
router.get('/plans', authenticate, WalletController.listPlans);
router.get('/plans/:id', authenticate, WalletController.getPlan);

// Admin Plan routes
router.post('/admin/plans', authenticate, authorize(['super_admin']), WalletController.createPlan);
router.put('/admin/plans/:id', authenticate, authorize(['super_admin']), WalletController.updatePlan);
router.delete('/admin/plans/:id', authenticate, authorize(['super_admin']), WalletController.deletePlan);
router.post('/admin/plans/seed', authenticate, authorize(['super_admin']), WalletController.seedPlans);

// Verification routes (no workspaceId param in path)
router.post('/recharge/verify', authenticate, WalletController.verifyRecharge);
router.post('/plan/verify', authenticate, WalletController.verifyPlanUpgrade);
router.post('/payment-method/verify', authenticate, WalletController.verifyPaymentMethod);

// Invoice routes
router.get('/invoices/:invoiceNumber/download', authenticate, WalletController.downloadInvoice);

// ══════════════════════════════════════════════
// DYNAMIC ROUTES (parameterized with :workspaceId)
// ══════════════════════════════════════════════

router.get('/:workspaceId', authenticateOrInternal, enforceWorkspaceParam, WalletController.getWallet);
router.post('/:workspaceId/sync', internalAuth, WalletController.syncWallet);
router.get('/:workspaceId/details', authenticateOrInternal, enforceWorkspaceParam, WalletController.getWorkspace);
router.get('/:workspaceId/transactions', authenticate, enforceWorkspaceParam, WalletController.getTransactions);
router.get('/:workspaceId/pricing', authenticateOrInternal, enforceWorkspaceParam, WalletController.getPricing);

router.post('/:workspaceId/recharge', authenticate, enforceWorkspaceParam, WalletController.createRechargeOrder);
router.post('/:workspaceId/plan', authenticate, enforceWorkspaceParam, WalletController.createPlanOrder);
router.post('/:workspaceId/verify-order', authenticate, enforceWorkspaceParam, WalletController.createVerificationOrder);

// Financial Adjustments (Internal Only)
router.post('/:workspaceId/add-funds', internalAuth, WalletController.addFunds);
router.post('/:workspaceId/deduct', internalAuth, WalletController.deductFunds);
router.post('/:workspaceId/reserve', internalAuth, WalletController.reserveCampaignBudget);
router.post('/:workspaceId/settle', internalAuth, WalletController.settleCampaignBudget);

export default router;
