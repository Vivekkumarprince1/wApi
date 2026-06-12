import mongoose from 'mongoose';
import { Kafka } from 'kafkajs';
import { Conversation, Message, Contact } from '../models/index.js';
import config from '../config/index.js';

export let kafkaProducer: any = null;
export let kafkaConsumer: any = null;
export let simulatedMode = false;

export async function initKafka() {
  try {
    const kafka = new Kafka({
      clientId: 'wapi-chat-service',
      brokers: [config.kafkaBroker],
      connectionTimeout: 3000,
    });

    // Setup Producer to emit real-time WS sync events
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();

    // Setup Consumer to process parsed inbound/outbound messages
    kafkaConsumer = kafka.consumer({ groupId: 'wapi-chat-service-group' });
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe({ topic: 'parsed-message-events', fromBeginning: false });

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        const value = message.value?.toString();
        if (!value) return;

        const maxRetries = 3;
        let attempt = 0;
        let success = false;
        let lastError = null;

        while (attempt < maxRetries && !success) {
          try {
            attempt++;
            const parsed = JSON.parse(value);
            await processParsedMessage(parsed);
            success = true;
          } catch (err: any) {
            lastError = err;
            console.error(`[Chat Service Kafka] Attempt ${attempt} failed:`, err.message);
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        if (!success) {
          console.error(`[Chat Service Kafka] Message processing failed after ${maxRetries} attempts. Publishing to DLQ...`);
          try {
            await kafkaProducer.send({
              topic: `${topic}-dlq`,
              messages: [{
                key: message.key,
                value: message.value,
                headers: {
                  ...message.headers,
                  'x-dead-letter-reason': Buffer.from(lastError?.message || 'unknown'),
                  'x-dead-letter-attempts': Buffer.from(String(maxRetries)),
                }
              }]
            });
            console.log(`[Chat Service Kafka] Successfully published dead letter to ${topic}-dlq`);
          } catch (dlqErr: any) {
            console.error('[Chat Service Kafka] Failed to publish dead letter to DLQ:', dlqErr.message);
          }
        }
      },
    });

    console.log(`[Chat Service Kafka] Successfully connected and subscribed to "parsed-message-events"`);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[Chat Service Kafka] Failed to connect to Kafka Broker at ${config.kafkaBroker}: ${error.message}`);
    }
    simulatedMode = true;
    console.warn(`[Chat Service Kafka] Failed to connect to Kafka: ${error.message}. Running in local fallback mode.`);
  }
}

/**
 * Workspace business-hours check, ported from the monolith's
 * isWithinBusinessHoursLegacy. Used to flag inbound messages for
 * "outside business hours" auto-replies.
 */
function isWithinBusinessHours(settings: any): boolean {
  if (!settings?.businessHours?.enabled) return true;

  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const schedule = settings.businessHours.schedule?.find(
    (s: any) => String(s.day).toLowerCase() === dayName
  );
  if (!schedule || !schedule.enabled) return false;

  return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
}

export async function processParsedMessage(parsed: any) {
  // 1. Process Status Updates
  if (parsed.type === 'status_update') {
    console.log(`[Chat Service Kafka] Status update event. Message provider ID: ${parsed.messageId}, status: ${parsed.status}`);

    const chatMessage = await Message.findOne({ 
      workspace: new mongoose.Types.ObjectId(parsed.workspaceId), 
      messageId: parsed.messageId 
    });

    if (chatMessage) {
      await (chatMessage as any).updateStatus(parsed.status, parsed.timestamp);
      await Conversation.findByIdAndUpdate(chatMessage.conversation, { lastActivityAt: new Date() });

      const syncPayload = {
        workspaceId: parsed.workspaceId,
        conversationId: chatMessage.conversation.toString(),
        messageId: chatMessage._id.toString(),
        type: 'message_status_updated',
        timestamp: new Date().toISOString(),
        payload: {
          messageId: chatMessage._id.toString(),
          providerMessageId: chatMessage.messageId,
          conversationId: chatMessage.conversation.toString(),
          status: chatMessage.status,
          timestamp: new Date().toISOString()
        }
      };

      await kafkaProducer.send({
        topic: 'chat-realtime-sync',
        messages: [{ key: chatMessage.conversation.toString(), value: JSON.stringify(syncPayload) }],
      });

      console.log(`[Chat Service Kafka] Message status updated and sync event published. msgId: ${chatMessage._id}`);

      if (chatMessage.campaign && chatMessage.campaign.id) {
        const campaignEvent = {
          name: 'MessageStatusUpdateEvent',
          data: {
            campaignId: chatMessage.campaign.id.toString(),
            status: chatMessage.status,
            contactId: chatMessage.contact?.toString(),
            whatsappMessageId: chatMessage.messageId,
            timestamp: new Date().toISOString()
          },
          ts: Date.now()
        };

        await kafkaProducer.send({
          topic: 'campaign-events',
          messages: [{ key: 'MessageStatusUpdateEvent', value: JSON.stringify(campaignEvent) }],
        });
        console.log(`[Chat Service Kafka] ✓ Dispatched MessageStatusUpdateEvent to campaign-events topic for campaign ${chatMessage.campaign.id}`);
      }
    } else {
      console.warn(`[Chat Service Kafka] Message not found for status update. providerId: ${parsed.messageId}`);
    }
    return;
  }

  // 2. Process Inbound Messages
  console.log(`[Chat Service Kafka] Ingested message event. Id: ${parsed.messageId}, type: ${parsed.type}`);

  // Dedup: providers (and Kafka redelivery) can replay the same message.
  // The monolith skipped already-persisted provider message ids — do the same.
  if (parsed.messageId && parsed.workspaceId) {
    const existing = await Message.findOne({
      workspace: new mongoose.Types.ObjectId(parsed.workspaceId),
      messageId: parsed.messageId,
    }).select('_id').lean();
    if (existing) {
      console.log(`[Chat Service Kafka] Duplicate message ${parsed.messageId} ignored.`);
      return;
    }
  }

  // Provider webhook timestamp (seconds or ms) — used for ordering and the
  // 24h customer-service window. Falls back to now.
  const eventTimestamp = (() => {
    const numeric = Number(parsed.timestamp);
    if (!numeric || Number.isNaN(numeric)) return new Date();
    return new Date(numeric > 1e12 ? numeric : numeric * 1000);
  })();

  let contactObjectId: mongoose.Types.ObjectId | null = null;
  
  if (parsed.contactId && mongoose.Types.ObjectId.isValid(parsed.contactId)) {
    contactObjectId = new mongoose.Types.ObjectId(parsed.contactId);
  } else {
    const phone = parsed.senderPhone || parsed.contactId || parsed.to;
    if (phone && parsed.workspaceId) {
      const contactServiceUrl = process.env.CONTACT_SERVICE_URL || 'http://localhost:3007';
      const resolveRes = await fetch(`${contactServiceUrl}/internal/v1/contacts/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET!,
          'x-workspace-id': parsed.workspaceId,
        },
        body: JSON.stringify({
          workspaceId: parsed.workspaceId,
          phone: phone,
          name: parsed.senderName || phone,
          ...(parsed.direction !== 'outbound'
            ? { lastInboundAt: eventTimestamp.toISOString() }
            : {}),
        }),
      });

      if (resolveRes.ok) {
        const resolveData = await resolveRes.json() as any;
        if (resolveData && resolveData.success && resolveData.data?._id) {
          contactObjectId = new mongoose.Types.ObjectId(resolveData.data._id);
        }
      }
    }
  }

  if (!contactObjectId) {
    throw new Error(`contactId could not be resolved for phone ${parsed.senderPhone}`);
  }

  let conversation = await Conversation.findOne({
    workspace: new mongoose.Types.ObjectId(parsed.workspaceId),
    contact: contactObjectId,
  });

  if (!conversation && parsed.workspaceId) {
    conversation = await Conversation.create({
      workspace: new mongoose.Types.ObjectId(parsed.workspaceId),
      contact: contactObjectId,
      status: 'open',
      isOpen: true,
      lastActivityAt: eventTimestamp,
      conversationType: (parsed.direction || 'inbound') === 'inbound' ? 'customer_initiated' : 'business_initiated',
      conversationStartedAt: eventTimestamp,
    });
  }

  if (conversation) {
    const messageType = parsed.type === 'status_update' ? 'text' : parsed.type;
    const chatMessage = await Message.create({
      workspace: conversation.workspace,
      conversation: conversation._id,
      contact: contactObjectId,
      direction: parsed.direction || 'inbound',
      type: messageType,
      text: parsed.text || '',
      mediaUrl: parsed.mediaUrl || '',
      messageId: parsed.messageId,
      status: parsed.direction === 'inbound' ? 'delivered' : 'sent',
      sentAt: eventTimestamp,
    });

    // Restore the monolith's full inbound conversation lifecycle: inbox-list
    // preview fields, unread counters, reopen-on-inbound and the 24h
    // customer-service window stamp.
    const isInbound = (parsed.direction || 'inbound') === 'inbound';
    let workspaceDoc: any = null;
    if (isInbound) {
      try {
        workspaceDoc = await Conversation.db
          .useDb('wapi')
          .collection('workspaces')
          .findOne(
            { _id: conversation.workspace },
            { projection: { inboxSettings: 1, settings: 1 } }
          );
      } catch (wsErr: any) {
        console.error('[Chat Service Kafka] Workspace lookup failed:', wsErr?.message || wsErr);
      }

      const preview =
        messageType === 'text'
          ? String(parsed.text || '').substring(0, 100)
          : `[${messageType}]`;

      conversation.set({
        lastInboundAt: eventTimestamp,
        lastCustomerMessageAt: eventTimestamp,
        lastActivityAt: eventTimestamp,
        lastMessageAt: eventTimestamp,
        lastMessagePreview: preview,
        lastMessageDirection: 'inbound',
        lastMessageType: messageType,
        isOpen: true,
        status: 'open',
        windowExpiresAt: new Date(eventTimestamp.getTime() + 24 * 60 * 60 * 1000),
      });
      conversation.messageCount = (conversation.messageCount || 0) + 1;
      (conversation as any).incrementUnreadForAllAgents();
      await conversation.save();

      // Auto-assignment (monolith parity): assign unassigned conversations
      // when the workspace has auto-assignment enabled.
      if (!conversation.assignedTo && workspaceDoc?.inboxSettings?.autoAssignmentEnabled) {
        try {
          const { AutoAssignService } = await import('./auto-assign-service.js');
          await AutoAssignService.assign(conversation.workspace, conversation._id).catch(() => {});
        } catch (assignErr: any) {
          console.error('[Chat Service Kafka] Auto-assign failed:', assignErr?.message || assignErr);
        }
      }
    } else {
      await Conversation.findByIdAndUpdate(conversation._id, { lastActivityAt: eventTimestamp });
    }

    const contactDoc = contactObjectId ? await Contact.findById(contactObjectId).lean() : null;
    const syncPayload = {
      workspaceId: conversation.workspace.toString(),
      conversationId: conversation._id.toString(),
      messageId: chatMessage._id.toString(),
      type: 'message_created',
      timestamp: new Date().toISOString(),
      payload: chatMessage,
      contact: contactDoc ? {
        _id: (contactDoc as any)._id.toString(),
        name: (contactDoc as any).name || 'Unknown',
        phone: (contactDoc as any).phone || '',
      } : null
    };

    await kafkaProducer.send({
      topic: 'chat-realtime-sync',
      messages: [{ key: conversation._id.toString(), value: JSON.stringify(syncPayload) }],
    });

    console.log(`[Chat Service Kafka] Message appended and real-time sync event published. messageId: ${parsed.messageId}`);

    // Hand the inbound message to the automation engine (auto-replies, answer-bot,
    // AI-intent matching, keyword workflows). Mirrors the monolith's
    // processInbound -> AutomationClient.handleInbound hand-off. Fire-and-forget so
    // message persistence is never blocked on the automation round-trip.
    if ((parsed.direction || 'inbound') === 'inbound') {
      const automationUrl = process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3001';
      void fetch(`${automationUrl}/api/automation/engine/trigger-inbound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET!,
        },
        body: JSON.stringify({
          workspaceId: conversation.workspace.toString(),
          contactId: contactObjectId.toString(),
          conversationId: conversation._id.toString(),
          messageId: chatMessage._id.toString(),
          body: parsed.text || '',
          phone: parsed.senderPhone || '',
          metadata: { type: parsed.type },
          isOutsideBusinessHours: !isWithinBusinessHours(workspaceDoc?.settings),
        }),
      })
        .then(async (r) => {
          if (!r.ok) {
            console.error(`[Chat Service Kafka] Automation trigger returned ${r.status} for message ${parsed.messageId}`);
          }
        })
        .catch((err) => {
          console.error('[Chat Service Kafka] Automation trigger failed:', err?.message || err);
        });
    }
  }
}

export async function replayDlq(dlqTopic: string, limit: number = 50) {
  if (simulatedMode || !kafkaProducer) {
    return { success: false, message: 'Kafka not connected or running in simulated mode' };
  }

  const targetTopic = dlqTopic.replace('-dlq', '');
  const kafka = new Kafka({
    clientId: 'wapi-chat-service-dlq-replay',
    brokers: [config.kafkaBroker],
    connectionTimeout: 3000,
  });

  const replayConsumer = kafka.consumer({ groupId: 'wapi-dlq-replay-group' });
  await replayConsumer.connect();
  await replayConsumer.subscribe({ topic: dlqTopic, fromBeginning: true });

  let replayedCount = 0;
  const messagesToReplay: any[] = [];

  await new Promise<void>((resolve, reject) => {
    let timeoutId = setTimeout(() => {
      resolve();
    }, 3000); // 3 seconds maximum to fetch messages

    replayConsumer.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        messagesToReplay.push({
          key: message.key,
          value: message.value,
          headers: message.headers,
        });

        replayedCount++;
        if (replayedCount >= limit) {
          clearTimeout(timeoutId);
          resolve();
        }
      }
    }).catch(reject);
  });

  await replayConsumer.disconnect();

  if (messagesToReplay.length > 0) {
    await kafkaProducer.send({
      topic: targetTopic,
      messages: messagesToReplay,
    });
    console.log(`[DLQ Replay] Successfully replayed ${messagesToReplay.length} messages from ${dlqTopic} to ${targetTopic}`);
  }

  return { success: true, replayedCount, targetTopic };
}

