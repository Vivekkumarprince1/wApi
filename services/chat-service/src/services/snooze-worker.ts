/**
 * snooze-worker.ts — chat-service
 *
 * In-process cron that re-opens snoozed conversations when their
 * `snoozedUntil` timestamp has elapsed. Publishes a ChatRealtimeSyncEvent
 * to the `chat-realtime-sync` EventBus topic so the websocket-gateway fans the
 * update out to connected clients.
 *
 * No BullMQ dependency — uses a plain setInterval (60-second tick).
 * Fire-and-forget: errors are logged but never bubble up.
 */

import mongoose from 'mongoose';
import { Conversation } from '../models/index.js';
import { eventProducer } from './eventBus.js';
import type { ChatRealtimeSyncEvent } from '@wapi/contracts';
import { EventTopics } from '@wapi/contracts';
import { randomUUID } from 'crypto';

const POLL_INTERVAL_MS = 60_000; // 1 minute

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function checkExpiredSnoozes(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return; // skip if DB not ready

  const now = new Date();
  const expired = await Conversation.find({
    status: 'snoozed',
    snoozedUntil: { $lte: now },
  }).lean();

  if (expired.length === 0) return;

  console.log(`[SnoozeWorker] ⏰ Re-opening ${expired.length} snoozed conversation(s)...`);

  await Promise.all(
    expired.map(async (conv: any) => {
      try {
        await Conversation.findByIdAndUpdate(conv._id, {
          $set: { status: 'open' },
          $unset: { snoozedUntil: '' },
        });

        // Publish real-time update via EventBus → websocket-gateway fans out
        if (eventProducer) {
          const payload: ChatRealtimeSyncEvent = {
            workspaceId: String(conv.workspace),
            conversationId: String(conv._id),
            messageId: randomUUID(), // synthetic event ID
            type: 'conversation_status_changed',
            timestamp: new Date().toISOString(),
            payload: {
              conversationId: String(conv._id),
              status: 'open',
              action: 'unsnooze',
              reason: 'snooze_expired',
            },
          };

          await eventProducer.send({
            topic: EventTopics.CHAT_REALTIME_SYNC,
            messages: [
              {
                key: String(conv.workspace),
                value: JSON.stringify(payload),
                headers: { 'event-type': 'conversation_status_changed' },
              },
            ],
          });
        }
      } catch (err: any) {
        console.error(`[SnoozeWorker] Failed to re-open conversation ${conv._id}:`, err.message);
      }
    }),
  );
}

/** Start the 60-second polling loop. Safe to call multiple times — only one interval runs. */
export function startSnoozeWorker(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    checkExpiredSnoozes().catch((err: any) =>
      console.error('[SnoozeWorker] Pulse error:', err.message),
    );
  }, POLL_INTERVAL_MS);

  console.log('[SnoozeWorker] 🚀 Started (60s poll interval).');
}

/** Stop the polling loop (call during SIGTERM). */
export function stopSnoozeWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[SnoozeWorker] Stopped.');
  }
}
