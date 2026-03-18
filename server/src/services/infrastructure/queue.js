const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const { redisUrl } = require('../../config');

// Shared connection for non-blocking commands
const { sharedConnection: connection } = require('./redisClient');

function createQueue(name) {
  // QueueScheduler was removed in BullMQ v4+ — only create if available
  if (QueueScheduler) {
    try { new QueueScheduler(name, { connection }); } catch (e) { /* v4+ doesn't need it */ }
  }
  return new Queue(name, { connection });
}

async function createWorker(name, processor) {
  return new Worker(name, processor, { connection });
}

module.exports = { createQueue, createWorker, connection };

