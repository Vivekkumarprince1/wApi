/**
 * eventService.ts — auth-service (formerly kafkaService)
 *
 * Redis Pub/Sub producer for publishing audit events to the `audit-events` channel,
 * plus a consumer that persists those events into the MongoDB `auditlogs`
 * collection so the admin UI can display them.
 *
 * Fire-and-forget producer: Redis outages never block admin HTTP flows.
 * Consumer: idempotent on eventId — safe to replay.
 */

import Redis from 'ioredis';
import mongoose from 'mongoose';
import type { AuditEventPayload } from '@wapi/contracts';
import { KafkaTopics } from '@wapi/contracts';

// ─── Producer ────────────────────────────────────────────────────────────────

let producerClient: Redis | null = null;

async function getProducer(): Promise<Redis | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!producerClient) {
    producerClient = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
    try {
      await producerClient.connect();
      console.log('[EventService] Redis Producer connected.');
    } catch (err: any) {
      console.warn('[EventService] Failed to connect producer:', err.message);
      producerClient = null;
    }
  }
  return producerClient;
}

/**
 * Publish an AuditEventPayload to the `audit-events` topic.
 */
export async function publishAuditEvent(payload: AuditEventPayload): Promise<void> {
  try {
    const p = await getProducer();
    if (!p) return;

    // Use KafkaTopics.AUDIT_EVENTS as the Redis channel
    await p.publish(KafkaTopics.AUDIT_EVENTS, JSON.stringify({
      key: payload.actorId,
      value: JSON.stringify(payload),
      headers: {
        'event-type': 'audit',
        'source-service': 'auth-service',
      },
    }));
  } catch (err: any) {
    console.error('[EventService] Failed to publish audit event:', err.message);
  }
}

/** Gracefully disconnect the producer (call during SIGTERM). */
export async function disconnectKafkaProducer(): Promise<void> {
  if (!producerClient) return;
  try {
    producerClient.disconnect();
    producerClient = null;
    console.log('[EventService] Producer disconnected.');
  } catch {
    // ignore
  }
}

// ─── Consumer ─────────────────────────────────────────────────────────────────

let consumerClient: Redis | null = null;

/**
 * Start consuming the `audit-events` channel.
 */
export async function startAuditConsumer(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) return;

  try {
    consumerClient = new Redis(url);

    consumerClient.subscribe(KafkaTopics.AUDIT_EVENTS, (err, count) => {
      if (err) {
        console.error('[EventService] Failed to subscribe: %s', err.message);
      } else {
        console.log(`[EventService] Subscribed to ${count} channels.`);
      }
    });

    consumerClient.on('message', async (channel, messageStr) => {
      if (channel !== KafkaTopics.AUDIT_EVENTS) return;
      
      try {
        const message = JSON.parse(messageStr);
        const raw = message.value;
        if (!raw) return;
        
        const payload: AuditEventPayload = JSON.parse(raw);
        const db = mongoose.connection.db;
        if (!db) return;

        await db.collection('auditlogs').updateOne(
          { eventId: payload.eventId },
          {
            $setOnInsert: {
              eventId: payload.eventId,
              userId: payload.actorId,
              action: payload.action,
              resource: payload.resource ?? null,
              details: payload.details ?? {},
              ip: payload.ip ?? null,
              userAgent: payload.userAgent ?? null,
              createdAt: new Date(payload.timestamp),
            },
          },
          { upsert: true },
        );
      } catch (err: any) {
        console.error('[EventService] Audit consumer error:', err.message);
      }
    });

    console.log('[EventService] Audit consumer running — persisting to auditlogs collection.');
  } catch (err: any) {
    console.warn('[EventService] Failed to start audit consumer:', err.message);
  }
}

/** Gracefully stop the audit consumer (call during SIGTERM). */
export async function stopAuditConsumer(): Promise<void> {
  if (!consumerClient) return;
  try {
    consumerClient.disconnect();
    consumerClient = null;
    console.log('[EventService] Audit consumer disconnected.');
  } catch {
    // ignore
  }
}
