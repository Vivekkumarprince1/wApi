import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { config } from '../config';
import { LedgerService } from '../services/LedgerService';
import { RazorpayService } from '../services/RazorpayService';
import { InvoiceService } from '../services/InvoiceService';
import { PricingService } from '../services/PricingService';
import { PlanModel, WorkspaceModel, WalletTransactionModel, OrderModel } from '../models';

const ledgerService = new LedgerService();
const invoiceService = new InvoiceService();

export class WalletController {
  static async getWorkspace(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const workspace = await WorkspaceModel.findById(workspaceId).populate('planId');
      if (!workspace) {
          // Sync on the fly or return default
          return res.json({ success: true, workspace: { billingStatus: 'active', planSlug: 'free' } });
      }
      res.json({ success: true, workspace: { ...workspace.toObject(), planSlug: (workspace.planId as any)?.slug || 'free' } });

    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getWallet(req: Request, res: Response) {

    try {
      const workspaceId = req.params.workspaceId as string;
      const wallet = await ledgerService.getWallet(workspaceId);
      res.json({ success: true, wallet });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async syncWallet(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { balancePaise } = req.body;
      const wallet = await ledgerService.syncLegacyBalance(workspaceId, Number(balancePaise));
      res.json({ success: true, wallet });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createRechargeOrder(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { amount, amountPaise } = req.body;
      
      const finalPaise = amountPaise || (amount ? Math.round(amount * 100) : 0);

      if (!finalPaise || finalPaise < 10000) {
        return res.status(400).json({ success: false, message: "Minimum recharge amount is 100 INR (10000 paise)" });
      }

      const order = await RazorpayService.createRechargeOrder(finalPaise, workspaceId);
      res.json({ 
        success: true, 
        orderId: order.id, 
        amount: order.amount, 
        currency: order.currency,
        keyId: config.razorpayKeyId 
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createPlanOrder(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { planId, planSlug, planName, monthlyBaseFeeCents, currency } = req.body;

      console.log(`[WalletController.createPlanOrder] workspaceId: ${workspaceId}, planId: ${planId}, planSlug: ${planSlug}, monthlyBaseFeeCents: ${monthlyBaseFeeCents}`);

      // Use the plan details passed from the main server instead of looking them up
      if (!planSlug) {
        return res.status(400).json({ success: false, message: "Plan slug is required" });
      }

      const amountPaise = monthlyBaseFeeCents || 0;

      // If amount is 0, this is a free plan activation
      if (amountPaise === 0) {
        await WorkspaceModel.findByIdAndUpdate(workspaceId, { 
          planId: planId,
          billingStatus: 'active'
        });
        return res.json({ 
          success: true, 
          requiresPayment: false, 
          message: "Plan activated successfully",
          planSlug: planSlug 
        });
      }

      const order = await RazorpayService.createPlanOrder(Number(amountPaise), workspaceId, planSlug);
      res.json({ 
        success: true, 
        requiresPayment: true,
        orderId: order.id, 
        amount: order.amount, 
        currency: currency || 'INR',
        keyId: config.razorpayKeyId,
        planSlug: planSlug
      });
    } catch (err: any) {
      console.error(`[WalletController.createPlanOrder] Error:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getTransactions(req: Request, res: Response) {

    try {
      const workspaceId = req.params.workspaceId as string;
      const { limit = '50', offset = '0' } = req.query;
      
      const txs = await WalletTransactionModel.find({ workspaceId })
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean();
      
      const txIds = txs.map(tx => tx._id.toString());
      const invoices = await invoiceService.getInvoicesForTransactions(txIds);
      const invoiceMap = new Map(invoices.map(inv => [inv.providerInvoiceId, inv.invoiceNumber]));

      const transactions = txs.map(tx => ({
        ...tx,
        _id: tx._id.toString(),
        amount: tx.amount || 0,
        invoiceNumber: invoiceMap.get(tx._id.toString()) || null
      }));

      res.json({ success: true, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async addFunds(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { amount, description, externalReferenceId } = req.body;
      const wallet = await ledgerService.credit(workspaceId, Number(amount), description as string, externalReferenceId as string);
      res.json({ success: true, wallet });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deductFunds(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { amount, description, externalReferenceId } = req.body;
      const wallet = await ledgerService.deduct(workspaceId, Number(amount), description as string, undefined, externalReferenceId as string);
      res.json({ success: true, wallet });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async reserveCampaignBudget(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { amount, campaignId } = req.body;
      await ledgerService.reserveCampaignBudget(workspaceId, Number(amount), campaignId as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async settleCampaignBudget(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { campaignId, reservedAmount, actualSpend } = req.body;
      await ledgerService.settleCampaignBudget(workspaceId, campaignId as string, Number(reservedAmount), Number(actualSpend));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async verifyRecharge(req: Request, res: Response) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, workspaceId, workspaceDetails } = req.body;
      const isValid = RazorpayService.verifySignature(razorpay_order_id as string, razorpay_payment_id as string, razorpay_signature as string);
      if (!isValid) throw new Error("INVALID_SIGNATURE");

      const payment = await RazorpayService.getPaymentDetails(razorpay_payment_id as string);
      const amountPaise = payment.amount;

      const wallet = await ledgerService.credit(workspaceId as string, Number(amountPaise), `Razorpay Recharge: ${razorpay_payment_id}`, razorpay_payment_id as string);

      const tx = await WalletTransactionModel.findOne({ externalReferenceId: razorpay_payment_id as string }).lean();
      if (tx) {
        await invoiceService.generateForTransaction(tx._id.toString(), {
          workspaceName: workspaceDetails?.workspaceName || workspaceDetails?.name || "Workspace",
          ownerName: workspaceDetails?.ownerName || "Admin",
          ownerEmail: workspaceDetails?.ownerEmail || "support@example.com",
          country: workspaceDetails?.country,
          walletCurrency: workspaceDetails?.walletCurrency || 'INR'
        });
      }

      res.json({ success: true, message: "Wallet credited successfully", wallet });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async verifyPlanUpgrade(req: Request, res: Response) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, workspaceId, workspaceDetails } = req.body;
      const isValid = RazorpayService.verifySignature(razorpay_order_id as string, razorpay_payment_id as string, razorpay_signature as string);
      if (!isValid) throw new Error("INVALID_SIGNATURE");

      const payment = await RazorpayService.getPaymentDetails(razorpay_payment_id as string);
      const amountPaise = payment.amount;
      const planSlug = payment.notes.planSlug;

      // 🛑 FIX: Stop crediting the wallet for plan purchases. 
      // Plan purchase is a direct payment for service, not a wallet recharge.
      const wallet = await ledgerService.getWallet(workspaceId as string);
      
      const tx = new WalletTransactionModel({
        workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
        amount: Number(amountPaise),
        type: 'PLAN_PURCHASE',
        previousBalance: wallet.availableBalance,
        newBalance: wallet.availableBalance, // No change to wallet balance
        description: `Plan Upgrade to ${planSlug}`,
        externalReferenceId: razorpay_payment_id as string,
        status: 'COMPLETED'
      });
      await tx.save();

      // Update workspace plan in microservice local cache/model
      const plan = await PlanModel.findOne({ slug: planSlug });
      if (plan) {
        await WorkspaceModel.findByIdAndUpdate(workspaceId, { 
          planId: plan._id,
          billingStatus: 'active'
        });
      }

      await invoiceService.generateForTransaction(tx._id.toString(), workspaceDetails);

      res.json({ success: true, wallet, planSlug });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getPricing(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { category } = req.query;
      const resolvedCategory = PricingService.resolveCategory(category as string);
      const cost = await PricingService.getCost(workspaceId, resolvedCategory);
      res.json({ success: true, cost, category: resolvedCategory });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async downloadInvoice(req: Request, res: Response) {
    try {
      const invoiceNumber = req.params.invoiceNumber as string;
      const { workspaceId, workspaceName, ownerName, ownerEmail, country } = req.query;
      const invoice = await invoiceService.getInvoiceByNumber(invoiceNumber, workspaceId as string);
      if (!invoice) return res.status(404).send("Invoice not found");

      const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: (invoice as any).currency || 'INR'
        }).format(cents / 100);
      };

      const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 800px; margin: 0 auto; padding: 40px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 40px; }
            .company-details h1 { margin: 0; color: #2563eb; }
            .invoice-details { text-align: right; }
            .invoice-details h2 { margin: 0; color: #64748b; font-weight: normal; text-transform: uppercase; letter-spacing: 2px; }
            .billing-info { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .bill-to h3, .bill-from h3 { margin-bottom: 10px; color: #64748b; text-transform: uppercase; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
            th { background-color: #f8fafc; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 12px; }
            .text-right { text-align: right; }
            .totals { margin-left: auto; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .totals-row.grand-total { font-weight: bold; font-size: 18px; border-bottom: none; border-top: 2px solid #333; }
            .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; }
            @media print {
                body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                .no-print { display: none !important; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="no-print" style="margin-bottom: 20px; text-align: right;">
                <button onclick="window.print()" style="padding: 10px 20px; background-color: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                    Print / Save PDF
                </button>
            </div>
            <div class="header">
                <div class="company-details">
                    <h1>wApi Platform</h1>
                    <p>Tech Corp Ltd.<br>123 Tech Park, Innovation Hub<br>support@wapi.example.com</p>
                </div>
                <div class="invoice-details">
                    <h2>Invoice</h2>
                    <p><strong>#${invoice.invoiceNumber}</strong><br>
                    Issued: ${new Date(invoice.issuedAt!).toLocaleDateString()}<br>
                    Status: <span style="color: #10b981; font-weight: bold;">PAID</span></p>
                </div>
            </div>

            <div class="billing-info">
                <div class="bill-to">
                    <h3>Bill To</h3>
                    <strong>Workspace: ${workspaceName}</strong><br>
                    Admin: ${ownerName}<br>
                    Email: ${ownerEmail}<br>
                    ${country || ''}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.lineItems.map(item => `
                    <tr>
                        <td>${item.description || item.type}</td>
                        <td class="text-right">${item.units}</td>
                        <td class="text-right">${formatCurrency(item.unitPriceCents)}</td>
                        <td class="text-right">${formatCurrency(item.amountCents)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                <div class="totals-row">
                    <span>Subtotal</span>
                    <span>${formatCurrency(invoice.subtotalCents)}</span>
                </div>
                <div class="totals-row">
                    <span>Tax (18% GST)</span>
                    <span>${formatCurrency(invoice.taxCents)}</span>
                </div>
                <div class="totals-row grand-total">
                    <span>Total Paid</span>
                    <span>${formatCurrency(invoice.totalCents)}</span>
                </div>
            </div>

            <div class="footer">
                <p>This is a computer generated invoice and does not require a physical signature.</p>
                <p>Thank you for your business!</p>
            </div>
        </div>
    </body>
    </html>
    `;
      res.send(htmlContent);
    } catch (err: any) {
      res.status(500).send("Internal Server Error");
    }
  }

  static async verifyPaymentMethod(req: Request, res: Response) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, workspaceId } = req.body;
      const isValid = RazorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) throw new Error("INVALID_SIGNATURE");

      // Mark workspace as active or save payment token logic here
      await WorkspaceModel.findByIdAndUpdate(workspaceId, {
          $set: { billingStatus: 'active' }
      });

      res.json({ success: true, message: "Payment method verified" });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // Need to fix razorpay createVerificationOrder which doesn't exist in the service, skipping it or using a dummy response.
  static async createVerificationOrder(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      // We are creating a ₹1 (100 paise) order for verifying the payment method
      const order = await RazorpayService.createRechargeOrder(100, workspaceId);
      res.json({ 
        success: true, 
        orderId: order.id, 
        amount: order.amount, 
        currency: order.currency,
        keyId: config.razorpayKeyId
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getBillingStats(req: Request, res: Response) {

    try {
      // 1. Calculate gross revenue
      const revenueResult = await WalletTransactionModel.aggregate([
        { $match: { type: { $in: ['RECHARGE', 'PLAN_PURCHASE'] }, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const grossRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

      // 2. Count active subs
      const activeSubs = await WorkspaceModel.countDocuments({ billingStatus: 'active' });

      res.json({
        success: true,
        data: {
          grossRevenue,
          activeSubs,
          churnRate: 1.4,
          pendingPayouts: 0
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getAllInvoices(req: Request, res: Response) {

    try {
      const { limit = '50' } = req.query;
      const invoices = await invoiceService.getAllInvoices(Number(limit));
      res.json({ success: true, invoices });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async handleRazorpayWebhook(req: Request, res: Response) {
    const correlationId = req.headers['x-correlation-id'] || 'system';
    
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const secret = config.razorpayWebhookSecret;
      
      if (!secret) {
        // Refuse unsigned payloads in production. Only allow the dev-only
        // pass-through if NODE_ENV is not production, and log loudly so it
        // can be spotted in CI/test envs.
        if (process.env.NODE_ENV === 'production') {
          console.error(`[Billing Webhook][${correlationId}] RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting request in production.`);
          return res.status(500).json({ success: false, message: "Webhook secret not configured" });
        }
        console.warn(`[Billing Webhook][${correlationId}] WARNING: Razorpay Webhook Secret not configured. Skipping verification (development only).`);
      } else {
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
           console.error(`[Billing Webhook][${correlationId}] Raw body missing for signature verification.`);
           return res.status(400).json({ success: false, message: "Raw body missing" });
        }

        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(rawBody)
          .digest("hex");

        // Constant-time compare so an attacker can't time-side-channel the
        // signature.
        const expectedBuf = Buffer.from(expectedSignature, 'utf8');
        const providedBuf = Buffer.from(String(signature || ''), 'utf8');
        if (
          expectedBuf.length !== providedBuf.length ||
          !crypto.timingSafeEqual(expectedBuf, providedBuf)
        ) {
          console.warn(`[Billing Webhook][${correlationId}] Invalid Razorpay signature detected.`);
          return res.status(400).json({ success: false, message: "Invalid signature" });
        }
      }

      const event = req.body;
      console.log(`[Billing Webhook][${correlationId}] Received Razorpay event: ${event.event}`);

      if (event.event === 'payment.captured' || event.event === 'order.paid') {
          const payment = event.payload.payment?.entity || event.payload.order?.entity;
          const paymentId = payment.id;
          const amount = payment.amount;
          const workspaceId = payment.notes?.workspaceId;

          if (!workspaceId) {
            console.warn(`[Billing Webhook][${correlationId}] No workspaceId in payment notes. Event: ${event.event}`);
            return res.status(200).json({ success: true, message: "No workspace context" });
          }

          // 1. Check for Idempotency
          const existingTx = await WalletTransactionModel.findOne({ externalReferenceId: paymentId });
          if (existingTx) {
            console.log(`[Billing Webhook][${correlationId}] Transaction ${paymentId} already processed. Skipping.`);
            return res.status(200).json({ success: true, message: "Already processed" });
          }

          const type = payment.notes?.type || 'RECHARGE';
          
          const { publishEvent } = await import("../lib/redis");

          if (type === 'PLAN_UPGRADE' || type === 'PLAN_PURCHASE') {
              const planSlug = payment.notes?.planSlug;
              console.log(`[Billing Webhook][${correlationId}] Processing Plan Upgrade: ${planSlug} for workspace ${workspaceId}`);
              
              const wallet = await ledgerService.getWallet(workspaceId);
              
              const tx = new WalletTransactionModel({
                workspaceId: new mongoose.Types.ObjectId(workspaceId),
                amount: Number(amount),
                type: 'PLAN_PURCHASE',
                previousBalance: wallet.availableBalance,
                newBalance: wallet.availableBalance,
                description: `Plan Upgrade to ${planSlug} (Webhook)`,
                externalReferenceId: paymentId,
                status: 'COMPLETED'
              });
              await tx.save();

              const plan = await PlanModel.findOne({ slug: planSlug });
              if (plan) {
                await WorkspaceModel.findByIdAndUpdate(workspaceId, { 
                  planId: plan._id,
                  billingStatus: 'active'
                });
              }
              
              await invoiceService.generateForTransaction(tx._id.toString(), {
                  workspaceName: payment.notes?.workspaceName || "Workspace",
                  ownerName: payment.notes?.ownerName || "Admin",
                  ownerEmail: payment.notes?.ownerEmail || "support@example.com"
              });

              await publishEvent('billing:events', 'plan_purchased', workspaceId, {
                  planSlug,
                  amount: amount / 100,
                  paymentId
              });
          } else if (payment.notes?.type === 'commerce_order') {
              const orderId = payment.notes?.order_id;
              if (orderId) {
                  const order = await OrderModel.findById(orderId);
                  if (order) {
                      await order.markAsPaid(paymentId, 'razorpay');
                      await order.save();
                      console.log(`[Billing Webhook][${correlationId}] Commerce Order ${order.orderNumber} marked as PAID via webhook.`);
                      
                      await publishEvent('billing:events', 'order_paid', workspaceId, {
                          orderId,
                          orderNumber: order.orderNumber,
                          amount: amount / 100
                      });
                  }
              }
          } else {
              console.log(`[Billing Webhook][${correlationId}] Crediting wallet for workspace ${workspaceId}: ${amount} paise`);
              await ledgerService.credit(workspaceId, amount, `Wallet Recharge (Webhook): ${paymentId}`, paymentId);
              const tx = await WalletTransactionModel.findOne({ externalReferenceId: paymentId }).lean();
              if (tx) {
                  await invoiceService.generateForTransaction(tx._id.toString(), {
                      workspaceName: payment.notes?.workspaceName || "Workspace",
                      ownerName: payment.notes?.ownerName || "Admin",
                      ownerEmail: payment.notes?.ownerEmail || "support@example.com"
                  });
              }

              await publishEvent('billing:events', 'wallet_recharged', workspaceId, {
                  amount: amount / 100,
                  paymentId
              });
          }
      }
      
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[Billing Webhook][${correlationId}] Fatal Error:`, err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

