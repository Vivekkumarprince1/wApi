const { createWorker, createQueue } = require('./queue');
const { startCampaignWorker } = require('../campaign/campaignWorkerService');

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE WORKER - Starts all BullMQ workers
// ═══════════════════════════════════════════════════════════════════════════════

async function runWorker() {
  console.log('[QueueWorker] BullMQ workers starting...');
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // Stage 3: Start Campaign Worker (CRITICAL)
  // ═══════════════════════════════════════════════════════════════════════════════
  try {
    startCampaignWorker();
    console.log('[QueueWorker] ✅ Campaign worker started');
  } catch (err) {
    console.error('[QueueWorker] ❌ Failed to start campaign worker:', err.message);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // WhatsApp Send Worker (legacy - non-critical)
  // ═══════════════════════════════════════════════════════════════════════════════
  try {
    const sendQueue = createQueue('whatsapp-sends');
    const sendWorker = await createWorker('whatsapp-sends', async (job) => {
      // LEGACY CAMPAIGN PATH DISABLED - use campaignWorkerService only
      if (job.name === 'campaign-batch') {
        throw new Error('LEGACY_CAMPAIGN_ENGINE_DISABLED');
      }
      console.log(`[QueueWorker] Processing send job: ${job.id}`);
      return { status: 'processed' };
    });
    sendWorker.on('completed', (job) => console.log('[QueueWorker] Send job completed', job.id));
    sendWorker.on('failed', (job, err) => console.error('[QueueWorker] Send job failed', job.id, err.message));
    console.log('[QueueWorker] ✅ WhatsApp send worker started');
  } catch (err) {
    console.error('[QueueWorker] WhatsApp send worker skipped:', err.message);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // Checkout Cart Expiry Worker (non-critical)
  // ═══════════════════════════════════════════════════════════════════════════════
  try {
    const CheckoutBotService = require('../commerce/checkoutBotService');
    const checkoutQueue = createQueue('checkout-expiry');
    const checkoutWorker = await createWorker('checkout-expiry', async (job) => {
      const { workspaceId } = job.data;
      console.log(`[CheckoutBot] Cleaning up expired carts for workspace: ${workspaceId}`);
      return CheckoutBotService.cleanupExpiredCarts(workspaceId);
    });
    checkoutWorker.on('completed', (job) => {
      console.log(`[CheckoutBot] Expiry cleanup completed for workspace: ${job.data.workspaceId}`);
    });
    checkoutWorker.on('failed', (job, err) => {
      console.error(`[CheckoutBot] Expiry cleanup failed for workspace: ${job.data.workspaceId}`, err.message);
    });
    console.log('[QueueWorker] ✅ Checkout expiry worker started');
  } catch (err) {
    console.error('[QueueWorker] Checkout expiry worker skipped:', err.message);
  }
}

/**
 * Schedule periodic cart expiry cleanup
 * Runs every hour
 */
async function scheduleCartExpiryCleanup() {
  try {
    const checkoutQueue = createQueue('checkout-expiry');
    const job = await checkoutQueue.add(
      'cleanup',
      { workspaceId: 'all' },
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
    console.error('[CheckoutBot] Failed to schedule cart expiry cleanup:', err.message);
  }
}

module.exports = { runWorker, scheduleCartExpiryCleanup };

