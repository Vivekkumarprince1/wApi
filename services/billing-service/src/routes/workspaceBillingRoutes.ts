/**
 * WORKSPACE BILLING ROUTES
 *
 * These routes are accessible at /workspace/billing/* on the billing-service.
 * The API gateway forwards /api/v1/workspace/billing/* → billing-service, stripping
 * the /api/v1/workspace/billing prefix so this service receives paths starting from /.
 *
 * The workspaceId is NOT in the path — it is extracted from the authenticated JWT
 * or the x-workspace-id gateway header (whichever the auth middleware resolves first).
 */

import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { Response, NextFunction } from 'express';

const router = Router();

/**
 * Injects req.params.workspaceId from the authenticated workspace context so that
 * existing controller methods that rely on req.params.workspaceId still work.
 */
const injectWorkspaceId = (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = req.workspace?._id?.toString() || req.workspace?.id;
  if (!workspaceId) {
    return res.status(400).json({ success: false, message: 'No workspace context in token' });
  }
  req.params.workspaceId = workspaceId;
  next();
};

// ── Aggregated billing info ─────────────────────────────────────────────────
router.get('/info', authenticate, WalletController.getBillingInfo);

// ── Plan management ─────────────────────────────────────────────────────────
router.get('/plan', authenticate, WalletController.listPlans);
router.post('/plan', authenticate, WalletController.switchPlan);
router.post('/plan/verify', authenticate, WalletController.verifyPlanUpgrade);

// ── Wallet recharge ─────────────────────────────────────────────────────────
router.post('/recharge', authenticate, injectWorkspaceId, WalletController.createRechargeOrder);
router.post('/recharge/verify', authenticate, WalletController.verifyRecharge);

// ── Payment method verification (₹1 auth hold) ─────────────────────────────
router.post('/payment-method', authenticate, injectWorkspaceId, WalletController.createVerificationOrder);
router.post('/payment-method/verify', authenticate, WalletController.verifyPaymentMethod);

// ── Conversation pricing map (paise per category) ──────────────────────────
router.get('/pricing', authenticate, injectWorkspaceId, WalletController.getPricingMap);

// ── Billing settings (autoPay, taxId) ──────────────────────────────────────
router.patch('/settings', authenticate, WalletController.updateBillingSettings);

// ── Invoice download ────────────────────────────────────────────────────────
router.get('/invoices/:invoiceNumber/download', authenticate, WalletController.downloadInvoice);

export default router;
