import { Types } from 'mongoose';
import { Notification } from '../models/index.js';
import { eventProducer, simulatedMode } from './eventBus.js';

export interface CreateNotificationOptions {
  workspaceId: string | Types.ObjectId;
  recipientId: string | Types.ObjectId;
  type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'campaign' | 'billing' | 'system';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  link?: string;
}

/**
 * Port of the monolith NotificationService: persist a notification (served by
 * auth-service GET /auth/notifications) and push it in real time through the
 * websocket-gateway (EventBus `chat-realtime-sync`, type `notification` →
 * `workspace:notification` to the recipient's personal room).
 */
export class NotificationService {
  static async notify(options: CreateNotificationOptions) {
    const { workspaceId, recipientId, type, title, message, metadata, link } = options;

    const notification = await Notification.create({
      workspace: workspaceId,
      recipient: recipientId,
      type,
      title,
      message,
      metadata,
      link,
    });

    if (eventProducer && !simulatedMode) {
      const syncPayload = {
        workspaceId: workspaceId.toString(),
        recipientId: recipientId.toString(),
        type: 'notification',
        timestamp: new Date().toISOString(),
        payload: {
          id: notification._id.toString(),
          type,
          title,
          message,
          metadata,
          link,
          createdAt: notification.createdAt,
        },
      };

      await eventProducer
        .send({
          topic: 'chat-realtime-sync',
          messages: [{ key: recipientId.toString(), value: JSON.stringify(syncPayload) }],
        })
        .catch((err: any) =>
          console.warn('[NotificationService] Realtime push failed:', err?.message || err)
        );
    }

    return notification;
  }
}
