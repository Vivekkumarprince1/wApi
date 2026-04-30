import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { authenticate, internalAuth, authorize } from '../middleware/auth';

const router = Router();

// ══════════════════════════════════════════════
// STATIC ROUTES (must be defined BEFORE dynamic :workspaceId routes)
// ══════════════════════════════════════════════

// Admin routes
router.get('/admin/all-invoices', authenticate, authorize(['super_admin']), WalletController.getAllInvoices);
router.get('/admin/stats', authenticate, authorize(['super_admin']), WalletController.getBillingStats);

// Verification routes (no workspaceId param in path)
router.post('/recharge/verify', authenticate, WalletController.verifyRecharge);
router.post('/plan/verify', authenticate, WalletController.verifyPlanUpgrade);
router.post('/payment-method/verify', authenticate, WalletController.verifyPaymentMethod);

// Invoice routes
router.get('/invoices/:invoiceNumber/download', authenticate, WalletController.downloadInvoice);

// ══════════════════════════════════════════════
// DYNAMIC ROUTES (parameterized with :workspaceId)
// ══════════════════════════════════════════════

router.get('/:workspaceId', authenticate, WalletController.getWallet);
router.post('/:workspaceId/sync', internalAuth, WalletController.syncWallet);
router.get('/:workspaceId/details', authenticate, WalletController.getWorkspace);
router.get('/:workspaceId/transactions', authenticate, WalletController.getTransactions);
router.get('/:workspaceId/pricing', authenticate, WalletController.getPricing);

router.post('/:workspaceId/recharge', authenticate, WalletController.createRechargeOrder);
router.post('/:workspaceId/plan', authenticate, WalletController.createPlanOrder);
router.post('/:workspaceId/verify-order', authenticate, WalletController.createVerificationOrder);

// Financial Adjustments (Internal Only)
router.post('/:workspaceId/add-funds', internalAuth, WalletController.addFunds);
router.post('/:workspaceId/deduct', internalAuth, WalletController.deductFunds);
router.post('/:workspaceId/reserve', internalAuth, WalletController.reserveCampaignBudget);
router.post('/:workspaceId/settle', internalAuth, WalletController.settleCampaignBudget);

export default router;
