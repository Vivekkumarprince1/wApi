/**
 * kafkaService.ts — auth-service
 *
 * Kafka producer for publishing audit events to the `audit-events` topic,
 * plus a consumer that persists those events into the MongoDB `auditlogs`
 * collection so the admin UI can display them.
 *
 * Fire-and-forget producer: Kafka outages never block admin HTTP flows.
 * Consumer: idempotent on eventId — safe to replay.
 * Both are no-ops when KAFKA_BROKER env var is not set (local dev).
 */

import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';
import mongoose from 'mongoose';
import type { AuditEventPayload } from '@wapi/contracts';
import { KafkaTopics } from '@wapi/contracts';

// ─── Producer ────────────────────────────────────────────────────────────────

let producer: Producer | null = null;
let isConnecting = false;

async function getProducer(): Promise<Producer | null> {
  const broker = process.env.KAFKA_BROKER;
  if (!broker) return null;

  if (producer) return producer;
  if (isConnecting) return null;

  isConnecting = true;
  try {
    const kafka = new Kafka({
      clientId: 'auth-service',
      brokers: [broker],
    });
    const p = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    await p.connect();
    producer = p;
    console.log('[KafkaService] Producer connected.');
  } catch (err: any) {
    console.warn('[KafkaService] Failed to connect producer:', err.message);
  } finally {
    isConnecting = false;
  }
  return producer;
}

/**
 * Publish an AuditEventPayload to the `audit-events` topic.
 * All errors are swallowed — Kafka failures must never break admin HTTP flows.
 */
export async function publishAuditEvent(payload: AuditEventPayload): Promise<void> {
  try {
    const p = await getProducer();
    if (!p) return;

    await p.send({
      topic: KafkaTopics.AUDIT_EVENTS,
      messages: [
        {
          key: payload.actorId,
          value: JSON.stringify(payload),
          headers: {
            'event-type': 'audit',
            'source-service': 'auth-service',
          },
        },
      ],
    });
  } catch (err: any) {
    console.error('[KafkaService] Failed to publish audit event:', err.message);
  }
}

/** Gracefully disconnect the producer (call during SIGTERM). */
export async function disconnectKafkaProducer(): Promise<void> {
  if (!producer) return;
  try {
    await producer.disconnect();
    producer = null;
    console.log('[KafkaService] Producer disconnected.');
  } catch {
    // ignore disconnect errors during shutdown
  }
}

// ─── Consumer ─────────────────────────────────────────────────────────────────

let consumer: Consumer | null = null;

/**
 * Start consuming the `audit-events` topic and persist each event to the
 * `auditlogs` MongoDB collection. Uses `updateOne` with `upsert:true` on
 * `eventId` so replays are safe.
 *
 * No-op if KAFKA_BROKER is not set.
 */
export async function startAuditConsumer(): Promise<void> {
  const broker = process.env.KAFKA_BROKER;
  if (!broker) return;

  try {
    const kafka = new Kafka({
      clientId: 'auth-service-audit-consumer',
      brokers: [broker],
    });

    consumer = kafka.consumer({ groupId: 'auth-service-audit-persister' });
    await consumer.connect();
    await consumer.subscribe({ topic: KafkaTopics.AUDIT_EVENTS, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString();
        if (!raw) return;
        try {
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
          console.error('[KafkaService] Audit consumer error:', err.message);
        }
      },
    });

    console.log('[KafkaService] Audit consumer running — persisting to auditlogs collection.');
  } catch (err: any) {
    console.warn('[KafkaService] Failed to start audit consumer:', err.message);
  }
}

/** Gracefully stop the audit consumer (call during SIGTERM). */
export async function stopAuditConsumer(): Promise<void> {
  if (!consumer) return;
  try {
    await consumer.disconnect();
    consumer = null;
    console.log('[KafkaService] Audit consumer disconnected.');
  } catch {
    // ignore
  }
}
