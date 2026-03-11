require('dotenv').config();
const mongoose = require('mongoose');
const { Message, WebhookLog } = require('../src/models');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);

  const msg = await Message.findOne({
    workspace: '699c21048e96ba1b49ab6945',
    direction: 'outbound'
  }).sort({ createdAt: -1 }).lean();

  console.log(JSON.stringify({
    latestOutbound: msg ? {
      id: msg._id,
      status: msg.status,
      whatsappMessageId: msg.whatsappMessageId,
      recipientPhone: msg.recipientPhone,
      body: msg.body,
      failureReason: msg.failureReason,
      sentAt: msg.sentAt,
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
      failedAt: msg.failedAt,
      createdAt: msg.createdAt,
      meta: msg.meta,
    } : null,
  }, null, 2));

  if (msg?.whatsappMessageId) {
    const logs = await WebhookLog.find({
      $or: [
        { 'payload.value.statuses.id': msg.whatsappMessageId },
        { 'payload.value.statuses.messageId': msg.whatsappMessageId },
        { 'payload.statuses.id': msg.whatsappMessageId },
        { 'payload.statuses.messageId': msg.whatsappMessageId },
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
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
