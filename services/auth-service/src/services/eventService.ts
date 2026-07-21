/**
 * eventService.ts — auth-service
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
import { EventTopics } from '@wapi/contracts';
import { Plan, Workspace } from '../models/index.js';

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

    // Use EventTopics.AUDIT_EVENTS as the Redis channel
    await p.publish(EventTopics.AUDIT_EVENTS, JSON.stringify({
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
export async function disconnectEventProducer(): Promise<void> {
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
let billingConsumerClient: Redis | null = null;

export async function applyPurchasedPlan(workspaceId: string, payload: any): Promise<void> {
  const slug = String(payload?.planSlug || '').trim();
  if (!workspaceId || !slug) throw new Error('plan_purchased event requires workspaceId and planSlug');

  const plan = await Plan.findOneAndUpdate(
    { $or: [{ slug }, { code: slug }] },
    {
      $set: {
        name: payload?.planName || slug,
        code: slug,
        slug,
        features: Array.isArray(payload?.features) ? payload.features : [],
        limits: payload?.limits || {},
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Workspace.findByIdAndUpdate(workspaceId, {
    $set: {
      plan: plan._id,
      planLimits: payload?.limits || {},
    },
  });
}

export async function startBillingPlanConsumer(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) return;

  billingConsumerClient = new Redis(url);
  await billingConsumerClient.subscribe('billing-events');
  billingConsumerClient.on('message', async (channel, messageStr) => {
    if (channel !== 'billing-events') return;
    try {
      const message = JSON.parse(messageStr);
      const envelope = JSON.parse(message.value || '{}');
      if (envelope.event !== 'plan_purchased') return;
      await applyPurchasedPlan(String(envelope.workspaceId || ''), envelope.payload || {});
    } catch (err: any) {
      console.error('[EventService] Billing plan consumer error:', err.message);
    }
  });
  console.log('[EventService] Billing plan consumer running.');
}

export async function stopBillingPlanConsumer(): Promise<void> {
  if (!billingConsumerClient) return;
  billingConsumerClient.disconnect();
  billingConsumerClient = null;
}

/**
 * Start consuming the `audit-events` channel.
 */
export async function startAuditConsumer(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) return;

  try {
    consumerClient = new Redis(url);

    consumerClient.subscribe(EventTopics.AUDIT_EVENTS, (err, count) => {
      if (err) {
        console.error('[EventService] Failed to subscribe: %s', err.message);
      } else {
        console.log(`[EventService] Subscribed to ${count} channels.`);
      }
    });

    consumerClient.on('message', async (channel, messageStr) => {
      if (channel !== EventTopics.AUDIT_EVENTS) return;

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
