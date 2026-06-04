import { InvoiceModel, InvoiceSequenceModel, WalletTransactionModel, IInvoiceDoc } from "../models";
import mongoose, { Types } from "mongoose";

export class InvoiceService {
  /**
   * Generates an invoice for a specific wallet transaction.
   */
  async generateForTransaction(transactionId: string | Types.ObjectId, workspaceDetails: any): Promise<IInvoiceDoc> {
    const transaction = await WalletTransactionModel.findById(transactionId);
    if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");

    // Avoid duplicate invoices for the same transaction
    const existing = await InvoiceModel.findOne({ providerInvoiceId: transactionId.toString() });
    if (existing) return existing;

    // 1. Determine Invoice Number (Sequential)
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const prefix = `INV-${yearMonth}-`;

    const sequence = await InvoiceSequenceModel.findOneAndUpdate(
      { prefix },
      { $inc: { lastNumber: 1 } },
      { upsert: true, new: true }
    );

    const invoiceNumber = `${prefix}${sequence!.lastNumber.toString().padStart(3, '0')}`;

    // 2. Line Items calculation
    const amountPaise = transaction.amount;
    const isIndianWorkspace = workspaceDetails.country?.toLowerCase() === 'india' || workspaceDetails.walletCurrency === 'INR';
    
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
    const invoice = await InvoiceModel.create({
      workspaceId: transaction.workspaceId,
      billingPeriod: yearMonth,
      status: 'paid',
      lineItems,
      subtotalCents,
      taxCents,
      totalCents: amountPaise,
      currency: transaction.type === 'RECHARGE' ? (workspaceDetails.walletCurrency || 'INR') : 'INR',
      issuedAt: new Date(),
      paidAt: new Date(),
      invoiceNumber,
      providerInvoiceId: transactionId.toString(),
      providerAmountCents: amountPaise,
      customerDetails: {
        workspaceName: workspaceDetails.workspaceName || workspaceDetails.name || 'Workspace',
        ownerName:     workspaceDetails.ownerName || 'Admin',
        ownerEmail:    workspaceDetails.ownerEmail || 'support@example.com',
        country:       workspaceDetails.country || ''
      }
    });

    return invoice;
  }

  async getInvoiceByNumber(invoiceNumber: string, workspaceId: string) {
    return await InvoiceModel.findOne({ 
        invoiceNumber, 
        workspaceId: new mongoose.Types.ObjectId(workspaceId) 
    }).lean();
  }

  async getInvoicesForTransactions(transactionIds: string[]) {
    return await InvoiceModel.find({ 
        providerInvoiceId: { $in: transactionIds } 
    }).select('providerInvoiceId invoiceNumber').lean();
  }

  async getAllInvoices(limit: number = 50) {
    return await InvoiceModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }
}

