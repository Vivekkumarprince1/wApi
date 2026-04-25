import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Campaign, Contact, CampaignBatch, CampaignMessage, Template, ICampaignModel, ICampaignBatchModel, Workspace, IWorkspaceDocument } from "@/lib/models";
import { JOB_TYPES, CampaignQueueService } from "./campaign-queue";
import { CampaignService } from "./campaign-service";
import { LedgerService } from "../billing/ledger-service";
import { PricingService } from "../billing/pricing-service";
import { PreflightPolicyService } from "./preflight-policy";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/db-connect";

import { getConnectionForWorker } from "../../ioredis";
import { broadcastToWorkspace } from "../socket-emitter";

/**
 * CAMPAIGN WORKER
 * 
 * Consumes and processes campaign jobs.
 * Port of legacy campaignWorkerService.js
 */
export class CampaignWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker('campaign-engine', this.processJob.bind(this), {
      connection: getConnectionForWorker('client'),
      concurrency: 5, // Process 5 batches in parallel
    });

    this.worker.on('completed', (job) => {
      console.log(`[CampaignWorker] ✅ Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[CampaignWorker] ❌ Job ${job?.id} failed:`, err.message);
    });
  }

  private async processJob(job: Job) {
    await dbConnect();

    try {
      console.log(`[CampaignWorker] Starting job ${job.id} (${job.name})`);
      switch (job.name) {
        case JOB_TYPES.CAMPAIGN_START:
          return await this.handleCampaignStart(job);
        case JOB_TYPES.BATCH_PROCESS:
          return await this.handleBatchProcess(job);
        case JOB_TYPES.CAMPAIGN_CHECK:
          return await this.handleMaintenance(job);
        default:
          console.warn(`[CampaignWorker] Unknown job type: ${job.name}`);
      }
    } catch (err: any) {
      console.error(`[CampaignWorker] CRITICAL ERROR in job ${job.id}:`, err.message);
      console.error(err.stack);
      throw err;
    }
  }


  /**
   * Initialize a campaign: Resolve filters and create staggered batches
   */
  private async handleCampaignStart(job: Job) {
    const { campaignId, workspaceId } = job.data;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    // 1. Pre-flight Validation (Hardened)
    const preflight = await PreflightPolicyService.validate(workspaceId, campaignId);
    if (!preflight.valid) {
        campaign.status = 'PAUSED';
        await (Campaign as ICampaignModel).addAuditEntry(campaignId, 'SYSTEM_PAUSED', { 
            reason: `Preflight failed: ${preflight.reason}`,
        systemInitiated: true,
        meta: { stage: 'preflight', reason: preflight.reason }
        });
        await campaign.save();

      const { broadcastToWorkspace } = require('../socket-emitter');
      broadcastToWorkspace(workspaceId.toString(), 'campaign:status_update', {
        campaignId,
        status: 'PAUSED',
        reason: preflight.reason,
        updatedAt: campaign.updatedAt,
      });
        throw new Error(`PREFLIGHT_FAILED: ${preflight.reason}`);
    }

    console.log(`[CampaignWorker] 📦 Initializing campaign ${campaignId}...`);

    // 1. Resolve Contacts (Dynamic Segments)
    let contacts = campaign.contacts;
    if (campaign.recipientFilter?.type === 'segment' && campaign.recipientFilter.segmentId) {
        const { SegmentService } = await import("./segment-service");
        contacts = await SegmentService.resolveSegmentContacts(workspaceId, campaign.recipientFilter.segmentId);
    }

    // 2. Budget Parking (Safety Guard)
    const template = await Template.findById(campaign.template).lean();
    const category = PricingService.resolveCategory(template?.category || 'MARKETING');
    const costPerMsg = await PricingService.getCost(workspaceId, category);
    const totalReservation = contacts.length * costPerMsg;

    if (totalReservation > 0) {
        await LedgerService.park(workspaceId, totalReservation, campaignId);
    }

    // 3. Create Batches
    const batches = await (CampaignBatch as ICampaignBatchModel).createBatches(
        campaignId,
        workspaceId,
        contacts.map(id => ({ _id: id })),
        campaign.template,
        campaign.templateSnapshot?.name || 'template',
        campaign.variableMapping,
        50 // Batch size
    );

    // 3. Stagger Enqueueing based on MPS (Defaulting to 20 MPS if not specified/legacy path)
    const workspace = await Workspace.findById(workspaceId).lean() as any;
    const mps = workspace?.inboxSettings?.agentMessagesPerMinute ? workspace.inboxSettings.agentMessagesPerMinute / 60 : 10;
    const delayPerBatch = Math.ceil((50 / mps) * 1000);

    for (let i = 0; i < batches.length; i++) {
        await CampaignQueueService.enqueueBatch(
            batches[i]._id,
            campaignId,
            workspaceId,
            i,
            i * delayPerBatch
        );
    }

    if (!campaign.startedAt) {
      campaign.startedAt = new Date();
      await (Campaign as ICampaignModel).addAuditEntry(campaignId, 'STARTED', {
        reason: 'Campaign worker started processing',
        meta: { workspaceId: workspaceId.toString() }
      });
    }

    campaign.status = 'RUNNING';
    await campaign.save();
    
    // Emit Real-time Update
    const { broadcastToWorkspace } = require('../socket-emitter');
    broadcastToWorkspace(workspaceId.toString(), "campaign:status_update", { 
        campaignId, 
        status: 'RUNNING',
      totalBatches: batches.length,
      updatedAt: campaign.updatedAt,
      startedAt: campaign.startedAt,
      batching: campaign.batching,
      totals: campaign.totals
    });
    
    return { totalBatches: batches.length };
  }

  /**
   * Process a single batch of messages
   */
  private async handleBatchProcess(job: Job) {
    const { batchId, campaignId, workspaceId } = job.data;
    const batch = await CampaignBatch.findById(batchId);
    if (!batch) throw new Error('Batch not found');

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    await batch.markStarted();

    console.log(`[CampaignWorker] 📤 Processing batch ${batchId} index ${batch.batchIndex}...`);

    const { WabaService } = await import("../messaging/waba-service");
    let successCount = 0;
    let failCount = 0;

    // 3. Resolve Workspace for Dynamic Throttling
    const workspace = await Workspace.findById(workspaceId).select('inboxSettings').lean() as any;
    const mps = workspace?.inboxSettings?.agentMessagesPerMinute ? workspace.inboxSettings.agentMessagesPerMinute / 60 : 10;
    const msgDelay = Math.max(20, Math.ceil(1000 / mps)); // min 20ms

    const CONCURRENCY = 10;
    const activeRecipients = batch.recipients.filter(r => !!r.contactId);

    const sendWithMessageRetry = async (recipient: any, retryCount = 0): Promise<any> => {
      try {
        const contact = await Contact.findById(recipient.contactId);
        if (!contact) return null;

        // Resolve Variables
        const components: any[] = [];
        const mapping = batch.variableMapping || {};
        
        // 1. Resolve Body Variables
        const bodyMapping = mapping.body || (typeof mapping === 'object' && !mapping.body && !mapping.header ? mapping : null);
        if (bodyMapping) {
            const bodyParams: any[] = [];
            const sortedKeys = Object.keys(bodyMapping).sort((a, b) => Number(a) - Number(b));
            for (const key of sortedKeys) {
                const field = bodyMapping[key];
                bodyParams.push({ type: 'text', text: String(this.resolveVar(contact, field) || '') });
            }
            if (bodyParams.length > 0) {
                components.push({ type: 'body', parameters: bodyParams });
            }
        }

        // 2. Resolve Header Variables / Media
        const headerMapping = mapping.header;
        const mediaUrl = mapping.mediaUrl || campaign.templateSnapshot?.headerType;

        if (headerMapping || mediaUrl) {
            const headerParams: any[] = [];
            if (mediaUrl && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(campaign.templateSnapshot?.headerType || '')) {
                const type = (campaign.templateSnapshot?.headerType || 'IMAGE').toLowerCase();
                headerParams.push({ type, [type]: { link: mediaUrl } });
            } else if (headerMapping) {
                const sortedKeys = Object.keys(headerMapping).sort((a, b) => Number(a) - Number(b));
                for (const key of sortedKeys) {
                    const field = headerMapping[key];
                    headerParams.push({ type: 'text', text: String(this.resolveVar(contact, field) || '') });
                }
            }
            if (headerParams.length > 0) {
                components.push({ type: 'header', parameters: headerParams });
            }
        }

        const result = await WabaService.sendTemplateMessage(
          workspaceId,
          contact.phone,
          batch.templateName || 'template',
          'en',
          components,
          {
            contactId: (contact as any)._id,
            campaignId: (campaign as any)._id,
            metadata: { batchId, batchIndex: batch.batchIndex, retry: retryCount }
          }
        );

        if (result.success) {
            const messageId = result.message?.whatsappMessageId || (result.result as any)?.messageId || (result as any).messageId;
            successCount++;
            await batch.updateRecipientStatus(contact._id.toString(), 'sent', messageId);

            await CampaignMessage.findOneAndUpdate(
              { campaign: campaignId, contact: contact._id },
              { 
                workspace: workspaceId,
                campaign: campaignId,
                contact: contact._id,
                phone: contact.phone,
                status: 'sent',
                whatsappMessageId: messageId,
                sentAt: new Date(),
                batchId: batch._id,
                batchIndex: batch.batchIndex
              },
              { upsert: true, new: true }
            );
        } else {
            const isRateLimit = result.result?.error?.includes('429') || result.result?.error?.includes('rate');
            if (isRateLimit && retryCount < 2) {
                const backoff = Math.pow(2, retryCount + 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoff));
                return sendWithMessageRetry(recipient, retryCount + 1);
            }

            failCount++;
            const error = result.result?.error || 'Unknown Error';
            await batch.updateRecipientStatus(contact._id.toString(), 'failed', null, error);

             await CampaignMessage.findOneAndUpdate(
              { campaign: campaignId, contact: contact._id },
              { 
                workspace: workspaceId,
                campaign: campaignId,
                contact: contact._id,
                phone: contact.phone,
                status: 'failed',
                failedAt: new Date(),
                failureReason: error,
                batchId: batch._id,
                batchIndex: batch.batchIndex
              },
              { upsert: true, new: true }
            );
        }
      } catch (err: any) {
        const isRateLimit = err.message?.includes('429') || err.response?.status === 429;
        if (isRateLimit && retryCount < 2) {
            const backoff = Math.pow(2, retryCount + 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, backoff));
            return sendWithMessageRetry(recipient, retryCount + 1);
        }

        failCount++;
        await batch.updateRecipientStatus(recipient.contactId as any, 'failed', null, err.message);
      }
    };

    // Parallel Chunked Execution
    for (let i = 0; i < activeRecipients.length; i += CONCURRENCY) {
        const chunk = activeRecipients.slice(i, i + CONCURRENCY);
        
        // Execute chunk in parallel
        await Promise.all(chunk.map(recipient => sendWithMessageRetry(recipient)));
        
        // Dynamic throttling based on MPS
        // If MPS is 10, processing 10 messages should ideally take 1 second
        const chunkDelay = Math.max(50, (chunk.length / mps) * 1000);
        if (i + CONCURRENCY < activeRecipients.length) {
            await new Promise(resolve => setTimeout(resolve, chunkDelay));
        }
    }

    await batch.markCompleted();

    // Update Campaign Totals
    const afterSent = await (Campaign as ICampaignModel).incrementTotal(campaignId.toString(), 'sent', successCount);
    const afterFailed = await (Campaign as ICampaignModel).incrementTotal(campaignId.toString(), 'failed', failCount);
    
    const afterAudit = await (Campaign as ICampaignModel).addAuditEntry(campaignId.toString(), 'BATCH_COMPLETED', {
      reason: `Batch ${batch.batchIndex + 1} processed`,
      meta: {
        batchIndex: batch.batchIndex,
        successCount,
        failCount,
        batchId: batch._id.toString()
      }
    });

    // Emit Real-time Progress Update
    const { broadcastToWorkspace } = require('../socket-emitter');
    const batchStats = await (CampaignBatch as unknown as ICampaignBatchModel).getCampaignBatchStats(campaignId);
    const isLastBatch = batchStats.completedBatches + batchStats.failedBatches >= batchStats.totalBatches;
    broadcastToWorkspace(workspaceId.toString(), "campaign:batch_completed", { 
        campaignId, 
        batchIndex: batch.batchIndex,
        successCount,
        failCount,
        isLastBatch,
        updatedAt: afterAudit?.updatedAt || afterFailed?.updatedAt || afterSent?.updatedAt || new Date(),
        totals: afterAudit?.totals || afterFailed?.totals || afterSent?.totals || campaign.totals,
        batching: afterAudit?.batching || campaign.batching
    });

    // 360. Check if campaign is finished (Atomic Guard)
    const stats = batchStats;
    if (stats.completedBatches + stats.failedBatches >= stats.totalBatches) {
        // Attempt to mark as COMPLETED atomically to avoid race conditions in resolution
        const finalizedCampaign = await Campaign.findOneAndUpdate(
          { _id: campaignId, status: { $ne: 'COMPLETED' } },
          { 
            $set: { 
              status: 'COMPLETED',
              completedAt: new Date()
            }
          },
          { new: true }
        );

        if (finalizedCampaign) {
          console.log(`[CampaignWorker] 🏁 Campaign ${campaignId} fully completed. Resolving ledger...`);
          
          // Calculate final costs
          const template = await Template.findById(finalizedCampaign.template).lean();
          const category = PricingService.resolveCategory(template?.category || 'MARKETING');
          const costPerMsg = await PricingService.getCost(workspaceId, category);
          
          const successAmount = (stats.totalSent || 0) * costPerMsg;
          const failAmount = (stats.totalFailed || 0) * costPerMsg;

          await LedgerService.resolveCampaign(workspaceId, successAmount, failAmount, campaignId);
          await CampaignService.releaseLock(campaignId);

          await (Campaign as ICampaignModel).addAuditEntry(campaignId, 'COMPLETED', { 
            reason: 'All batches processed',
            meta: {
              successAmount,
              failAmount,
              batchCount: stats.totalBatches
            }
          });

          // Emit Real-time Completion
          broadcastToWorkspace(workspaceId.toString(), "campaign:status_update", { 
              campaignId, 
              status: 'COMPLETED',
              successAmount,
              failAmount,
              updatedAt: finalizedCampaign.updatedAt,
              completedAt: finalizedCampaign.completedAt,
              totals: finalizedCampaign.totals,
              batching: finalizedCampaign.batching
          });
        }
    }

    return { successCount, failCount };
  }

  private resolveVar(contact: any, field: string): any {
     if (!field || typeof field !== 'string') return field;
     const parts = field.split('.');
     let curr = contact;
     for (const p of parts) {
         if (!curr) return null;
         curr = curr[p];
     }
     return curr || field; // Fallback to raw text if no property matches
  }

  /**
   * Handle periodic maintenance (Scheduling fallback + Stalled recovery)
   */
  private async handleMaintenance(job: Job) {
      console.log('[CampaignWorker] 🛠️ Running periodic maintenance...');
      const { CampaignScheduler } = await import("./campaign-scheduler");
      try {
        const scheduledStarted = await CampaignScheduler.processScheduledCampaigns();
        const stalledRecovered = await CampaignScheduler.processStalledCampaigns();
        return { scheduledStarted, stalledRecovered };
      } catch (err: any) {
        const message = err?.message || 'unknown maintenance error';
        if (/timed out|MongoServerSelectionError|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
          console.warn(`[CampaignWorker] Maintenance skipped due to DB connectivity issue: ${message}`);
          return { scheduledStarted: 0, stalledRecovered: 0, skipped: true, reason: 'db_unavailable' };
        }
        throw err;
      }
  }
}
