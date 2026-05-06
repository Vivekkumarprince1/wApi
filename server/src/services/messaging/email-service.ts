import { Types } from 'mongoose';
import { Message, Conversation } from '../../models';

export class EmailService {
  /**
   * Send Email via provider (Placeholder)
   */
  static async sendEmail(options: {
    workspaceId: string | Types.ObjectId;
    email: string;
    subject: string;
    html: string;
    contactId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    sentBy: string | Types.ObjectId;
  }) {
    const { workspaceId, email, subject, html, contactId, conversationId, sentBy } = options;

    console.log(`[EmailService] Sending Email to ${email}: ${subject}`);

    const snippet = html.replace(/<[^>]*>/g, '').substring(0, 100);

    // Create message record
    const newMessage = await Message.create({
      workspace: workspaceId,
      contact: contactId,
      conversation: conversationId,
      direction: 'outbound',
      type: 'email',
      body: snippet,
      subject,
      emailHtml: html,
      snippet,
      sentBy,
      status: 'sent',
      sentAt: new Date(),
    });

    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: {
        lastMessageAt: new Date(),
        lastMessagePreview: snippet,
        lastMessageDirection: 'outbound',
        lastMessageType: 'email',
        lastActivityAt: new Date(),
      }
    });

    return { success: true, message: newMessage };
  }
}
