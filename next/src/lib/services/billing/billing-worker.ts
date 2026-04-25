import { Worker, Job } from 'bullmq';
import { getSharedConnection } from '../../ioredis';
import { BILLING_JOBS } from './billing-queue';
import { Workspace, Plan, WalletTransaction } from '@/lib/models';
import { LedgerService } from './ledger-service';
import { BillingInvoiceService } from './billing-invoice-service';
import dbConnect from '@/lib/db-connect';

export class BillingWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      'billing-engine',
      async (job: Job) => {
        await dbConnect();
        
        if (job.name === BILLING_JOBS.RENEWAL_CHECK) {
          await this.processRenewals();
        }
      },
      {
        connection: getSharedConnection(),
        concurrency: 1, // Single worker to avoid race conditions in balance deduction
      }
    );

    this.worker.on('completed', (job) => console.log(`[BillingWorker] ✅ Job ${job.id} completed.`));
    this.worker.on('failed', (job, err) => console.error(`[BillingWorker] ❌ Job ${job?.id} failed:`, err));
  }

  /**
   * Main renewal logic
   */
  private async processRenewals() {
    console.log('[BillingWorker] Starting renewal check cycle...');
    const now = new Date();

    // 1. Find active paid workspaces where billingPivotDate <= now
    const workspacesToRenew = await Workspace.find({
      billingStatus: 'active',
      autoPay: true,
      billingPivotDate: { $lte: now },
      planId: { $ne: 'free' } // Exclude free plans
    }).populate('plan');

    console.log(`[BillingWorker] Found ${workspacesToRenew.length} workspaces for renewal.`);

    for (const workspace of workspacesToRenew) {
      try {
        const plan = workspace.plan as any as typeof Plan.prototype;
        if (!plan || (plan as any).monthlyBaseFeeCents === 0) continue;

        const renewalAmount = (plan as any).monthlyBaseFeeCents;

        // 2. Attempt Wallet Deduction
        try {
          const result = await LedgerService.deduct(workspace._id, renewalAmount, {
            type: 'SUBSCRIPTION_PURCHASE',
            referenceType: 'SUBSCRIPTION',
            description: `Auto-renewal: ${plan.name} Plan`
          });

          if (result.success) {
            // 3. Successful Renewal: Update Pivot
            const nextPivot = new Date(workspace.billingPivotDate!);
            const interval = (plan as any).billingIntervalMonths || 1;
            nextPivot.setMonth(nextPivot.getMonth() + interval);
            
            workspace.billingPivotDate = nextPivot;
            workspace.billingStatus = 'active';
            await (workspace as any).save();

            // 4. Generate Invoice (Find the transaction first)
            const transaction = await WalletTransaction.findOne({
                workspace: workspace._id,
                type: 'SUBSCRIPTION_PURCHASE',
                description: `Auto-renewal: ${plan.name} Plan`
            }).sort({ createdAt: -1 });

            if (transaction) {
               await BillingInvoiceService.generateForTransaction(transaction._id);
            }

            console.log(`[BillingWorker] ✅ Renewed workspace ${workspace.name} for ${renewalAmount} paise.`);
          }
        } catch (deductErr: any) {
          if (deductErr.message.includes('INSUFFICIENT_BALANCE')) {
            console.warn(`[BillingWorker] ⚠️ Insufficient balance for ${workspace.name}. Marking past_due.`);
            workspace.billingStatus = 'past_due';
            await (workspace as any).save();
            
            // TODO: Trigger notification to user
          } else {
            throw deductErr;
          }
        }
      } catch (err: any) {
        console.error(`[BillingWorker] ❌ Failed to renew workspace ${workspace._id}:`, err.message);
      }
    }
  }

  public async stop() {
    await this.worker.close();
  }
}
