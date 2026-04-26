/**
 * BILLING INVOICE SERVICE
 * 
 * Orchestrates automated generation of tax-compliant invoices.
 */

import { Invoice, WalletTransaction, Workspace, Plan } from "@/lib/models";
import { InvoiceSequence } from "@/lib/models/billing/InvoiceSequence";
import mongoose, { Types } from "mongoose";

export class BillingInvoiceService {
  /**
   * Generates an invoice for a specific wallet transaction.
   * Usually called after a successful RECHARGE or SUBSCRIPTION_PURCHASE.
   */
  static async generateForTransaction(transactionId: string | Types.ObjectId): Promise<any> {
    const transaction = await WalletTransaction.findById(transactionId);
    if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");

    // Avoid duplicate invoices for the same transaction
    const existing = await Invoice.findOne({ providerInvoiceId: transactionId.toString() });
    if (existing) return existing;

    const workspace = await Workspace.findById(transaction.workspace).lean();
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");

    // 1. Determine Invoice Number (Sequential)
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const prefix = `INV-${yearMonth}-`;

    const sequence = await InvoiceSequence.findOneAndUpdate(
      { prefix },
      { $inc: { lastNumber: 1 } },
      { upsert: true, new: true }
    );

    const invoiceNumber = `${prefix}${sequence!.lastNumber.toString().padStart(3, '0')}`;

    // 2. Line Items calculation
    const amountPaise = transaction.amount;
    const isIndianWorkspace = workspace.country?.toLowerCase() === 'india' || workspace.walletCurrency === 'INR';
    
    // Tax Calculation (Simple 18% GST for India)
    const taxRate = isIndianWorkspace ? 0.18 : 0;
    const subtotalCents = Math.round(amountPaise / (1 + taxRate));
    const taxCents = amountPaise - subtotalCents;

    const lineItems = [{
      type: transaction.type,
      units: 1,
      unitPriceCents: subtotalCents,
      amountCents: subtotalCents,
      description: transaction.description || `Platform Service: ${transaction.type}`
    }];

    // 3. Create Invoice Record
    const invoice = await Invoice.create({
      workspace: workspace._id,
      billingPeriod: yearMonth,
      status: 'paid',
      lineItems,
      subtotalCents,
      taxCents,
      totalCents: amountPaise,
      currency: transaction.currency || workspace.walletCurrency || 'INR',
      issuedAt: new Date(),
      paidAt: new Date(),
      invoiceNumber,
      providerInvoiceId: transaction.referenceId?.toString() || transaction._id.toString(), 
      providerAmountCents: amountPaise,
    });

    console.log(`[BillingInvoiceService] ✅ Generated invoice ${invoiceNumber} for transaction ${transactionId}`);
    
    return invoice;
  }
}
