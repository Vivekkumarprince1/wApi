const { createWorker } = require('./queue');
const { processSendJob } = require('./whatsappService');

async function runWorker() {
  console.log('BullMQ worker starting for whatsapp-sends');
  // Create a worker that uses processSendJob to process jobs
  const worker = await createWorker('whatsapp-sends', async (job) => {
    return processSendJob(job);
  });
  worker.on('completed', (job) => console.log('Job completed', job.id));
  worker.on('failed', (job, err) => console.error('Job failed', job.id, err));
}

module.exports = { runWorker };
