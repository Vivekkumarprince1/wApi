import { Types } from 'mongoose';
import { Notification } from '../models';
import * as SocketService from './socket-service';

export interface CreateNotificationOptions {
  workspaceId: string | Types.ObjectId;
  recipientId: string | Types.ObjectId;
  type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'campaign' | 'billing' | 'system';
  title: string;
  body: string;
  metadata?: Record<string, any>;
  link?: string;
}

export class NotificationService {
  /**
   * Create and dispatch a notification
   */
  static async notify(options: CreateNotificationOptions) {
    const { workspaceId, recipientId, type, title, body, metadata, link } = options;

    // 1. Persist to Database
    const notification = await Notification.create({
      workspace: workspaceId,
      recipient: recipientId,
      type,
      title,
      body,
      metadata,
      link
    });

    // 2. Push via Socket.IO for real-time delivery
    SocketService.emitNotification(recipientId.toString(), {
      id: notification._id,
      type,
      title,
      body,
      metadata,
      link,
      createdAt: notification.createdAt
    });

    return notification;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string | Types.ObjectId, userId: string | Types.ObjectId) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
  }

  /**
   * Mark all as read for a user
   */
  static async markAllAsRead(workspaceId: string | Types.ObjectId, userId: string | Types.ObjectId) {
    return await Notification.updateMany(
      { workspace: workspaceId, recipient: userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(workspaceId: string | Types.ObjectId, userId: string | Types.ObjectId) {
    return await Notification.countDocuments({
      workspace: workspaceId,
      recipient: userId,
      read: false
    });
  }

  /**
   * Notify a team (all members)
   */
  static async notifyTeam(workspaceId: string | Types.ObjectId, teamId: string | Types.ObjectId, options: Omit<CreateNotificationOptions, 'recipientId' | 'workspaceId'>) {
    const { Team } = await import('../models');
    const team = await Team.findById(teamId).populate('members.user');
    if (!team) return;

    const notifications = team.members.map(member => 
      this.notify({
        ...options,
        workspaceId,
        recipientId: (member.user as any)._id
      })
    );

    return await Promise.all(notifications);
  }
}
