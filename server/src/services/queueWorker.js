const { createWorker, createQueue } = require('./queue');
const { processSendJob, processCampaignBatch } = require('./whatsappService');
const CheckoutBotService = require('./checkoutBotService');

// Queues
const sendQueue = createQueue('whatsapp-sends');
const checkoutQueue = createQueue('checkout-expiry');

async function runWorker() {
  console.log('BullMQ worker starting for whatsapp-sends and checkout-expiry');
  
  // Worker for WhatsApp messages
  const sendWorker = await createWorker('whatsapp-sends', async (job) => {
    if (job.name === 'campaign-batch') {
      return processCampaignBatch(job);
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
