require('dotenv').config();
const mongoose = require('mongoose');
const { Message, WebhookLog } = require('../src/models');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI_NOT_CONFIGURED');
  }

  await mongoose.connect(uri);

  const messageId = process.argv[2];
  if (!messageId) {
    throw new Error('MESSAGE_ID_REQUIRED');
  }

  const msg = await Message.findOne({ whatsappMessageId: messageId }).sort({ createdAt: -1 }).lean();
  console.log(JSON.stringify({
    message: msg ? {
      id: msg._id,
      status: msg.status,
      whatsappMessageId: msg.whatsappMessageId,
      failureReason: msg.failureReason,
      sentAt: msg.sentAt,
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
      failedAt: msg.failedAt,
      recipientPhone: msg.recipientPhone,
      meta: msg.meta,
    } : null,
  }, null, 2));

  const logs = await WebhookLog.find({
    $or: [
      { 'payload.value.statuses.id': messageId },
      { 'payload.value.statuses.messageId': messageId },
      { 'payload.statuses.id': messageId },
      { 'payload.statuses.messageId': messageId },
    ]
  }).sort({ createdAt: -1 }).lean();

  console.log(JSON.stringify({
    matchingWebhookLogs: logs.map((l) => ({
      id: l._id,
      createdAt: l.createdAt,
      eventType: l.eventType,
      processed: l.processed,
      error: l.error,
      statuses: l.payload?.value?.statuses || l.payload?.statuses || [],
    })),
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
