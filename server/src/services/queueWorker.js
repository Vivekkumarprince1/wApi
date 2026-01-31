const { createWorker, createQueue } = require('./queue');
const { processSendJob } = require('./whatsappService');
const CheckoutBotService = require('./checkoutBotService');
const { startCampaignWorker } = require('./campaignWorkerService');

// Queues
const sendQueue = createQueue('whatsapp-sends');
const checkoutQueue = createQueue('checkout-expiry');

async function runWorker() {
  console.log('BullMQ worker starting for whatsapp-sends, checkout-expiry, and campaign-engine');
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // Stage 3: Start Campaign Worker
  // ═══════════════════════════════════════════════════════════════════════════════
  try {
    startCampaignWorker();
    console.log('[QueueWorker] Campaign worker started');
  } catch (err) {
    console.error('[QueueWorker] Failed to start campaign worker:', err.message);
  }
  
  // Worker for WhatsApp messages (legacy sends only)
    const sendWorker = await createWorker('whatsapp-sends', async (job) => {
      // LEGACY CAMPAIGN PATH DISABLED - use campaignWorkerService only
      if (job.name === 'campaign-batch') {
        throw new Error('LEGACY_CAMPAIGN_ENGINE_DISABLED');
      }
      return processSendJob(job);
    });
  sendWorker.on('completed', (job) => console.log('Send job completed', job.id));
  sendWorker.on('failed', (job, err) => console.error('Send job failed', job.id, err));
  
  // Worker for checkout cart expiry
  const checkoutWorker = await createWorker('checkout-expiry', async (job) => {
    const { workspaceId } = job.data;
    console.log(`[CheckoutBot] Cleaning up expired carts for workspace: ${workspaceId}`);
    return CheckoutBotService.cleanupExpiredCarts(workspaceId);
  });
  checkoutWorker.on('completed', (job) => {
    console.log(`[CheckoutBot] Expiry cleanup completed for workspace: ${job.data.workspaceId}`);
  });
  checkoutWorker.on('failed', (job, err) => {
    console.error(`[CheckoutBot] Expiry cleanup failed for workspace: ${job.data.workspaceId}`, err);
  });
}

/**
 * Schedule periodic cart expiry cleanup
 * Runs every hour
 */
async function scheduleCartExpiryCleanup() {
  try {
    // Schedule job to run every hour
    const job = await checkoutQueue.add(
      'cleanup',
      { workspaceId: 'all' }, // Mark as global cleanup
      {
        repeat: {
          every: 60 * 60 * 1000 // Every hour
        },
        jobId: 'checkout-expiry-cleanup-recurring'
      }
    );
    
    console.log('[CheckoutBot] Scheduled recurring cart expiry cleanup job');
    return job;
  } catch (err) {
    console.error('[CheckoutBot] Failed to schedule cart expiry cleanup:', err);
  }
}

module.exports = { runWorker, scheduleCartExpiryCleanup };
