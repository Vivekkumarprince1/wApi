import { Types } from 'mongoose';
import { Message, Conversation } from '../../models';
import * as SocketService from '../socket-service';

export class SmsService {
  /**
   * Send SMS via provider (Placeholder)
   */
  static async sendSms(options: {
    workspaceId: string | Types.ObjectId;
    phone: string;
    text: string;
    contactId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    sentBy: string | Types.ObjectId;
  }) {
    const { workspaceId, phone, text, contactId, conversationId, sentBy } = options;

    console.log(`[SmsService] Sending SMS to ${phone}: ${text}`);

    // Create message record
    const newMessage = await Message.create({
      workspace: workspaceId,
      contact: contactId,
      conversation: conversationId,
      direction: 'outbound',
      type: 'sms',
      body: text,
      sentBy,
      status: 'sent',
      sentAt: new Date(),
    });

    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: {
        lastMessageAt: new Date(),
        lastMessagePreview: text.substring(0, 100),
        lastMessageDirection: 'outbound',
        lastMessageType: 'sms',
        lastActivityAt: new Date(),
      }
    });

    return { success: true, message: newMessage };
  }
}
