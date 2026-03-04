const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const { redisUrl } = require('../config');

// BullMQ requires maxRetriesPerRequest to be null
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

function createQueue(name) {
  // create scheduler for delayed jobs and retries
  new QueueScheduler(name, { connection });
  return new Queue(name, { connection });
}

async function createWorker(name, processor) {
  return new Worker(name, processor, { connection });
}

module.exports = { createQueue, createWorker, connection };
