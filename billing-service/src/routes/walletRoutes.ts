import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';

const router = Router();

// ══════════════════════════════════════════════
// STATIC ROUTES (must be defined BEFORE dynamic :workspaceId routes)
// ══════════════════════════════════════════════

// Admin routes
router.get('/admin/all-invoices', WalletController.getAllInvoices);
router.get('/admin/stats', WalletController.getBillingStats);

// Verification routes (no workspaceId param in path)
router.post('/recharge/verify', WalletController.verifyRecharge);
router.post('/plan/verify', WalletController.verifyPlanUpgrade);
router.post('/payment-method/verify', WalletController.verifyPaymentMethod);

// Invoice routes
router.get('/invoices/:invoiceNumber/download', WalletController.downloadInvoice);

// ══════════════════════════════════════════════
// DYNAMIC ROUTES (parameterized with :workspaceId)
// ══════════════════════════════════════════════

router.get('/:workspaceId', WalletController.getWallet);
router.post('/:workspaceId/sync', WalletController.syncWallet);
router.get('/:workspaceId/details', WalletController.getWorkspace);
router.get('/:workspaceId/transactions', WalletController.getTransactions);
router.get('/:workspaceId/pricing', WalletController.getPricing);

router.post('/:workspaceId/recharge', WalletController.createRechargeOrder);
router.post('/:workspaceId/plan', WalletController.createPlanOrder);
router.post('/:workspaceId/verify-order', WalletController.createVerificationOrder);
router.post('/:workspaceId/add-funds', WalletController.addFunds);
router.post('/:workspaceId/deduct', WalletController.deductFunds);
router.post('/:workspaceId/reserve', WalletController.reserveCampaignBudget);
router.post('/:workspaceId/settle', WalletController.settleCampaignBudget);

export default router;
