import { AutoReply, IAutoReplyDocument } from "../models";
import { AutoReplyLog } from "../models";
import { chatInternalClient } from "../lib/internal-client";
import { Types } from "mongoose";

/**
 * AUTO-REPLY SERVICE (Stateless Microservice Version)
 */
export class AutoReplyService {
  /**
   * Check for a matching auto-reply for an inbound message
   */
  static async findMatch(messageBody: string, workspaceId: string | Types.ObjectId, context: any = {}): Promise<IAutoReplyDocument | null> {
    const autoReplies = await AutoReply.find({ workspace: workspaceId, enabled: true });
    
    const lowerBody = (messageBody || '').toLowerCase().trim();
    if (!lowerBody) return null;

    // Sort priority: keyword > outside_business_hours > always
    const sorted = autoReplies.sort((a, b) => {
      const priority = { 'keyword': 1, 'outside_business_hours': 2, 'always': 3 };
      return (priority[a.triggerType] || 99) - (priority[b.triggerType] || 99);
    });

    for (const rule of sorted) {
      let matches = false;

      if (rule.triggerType === 'keyword') {
        matches = this.matchKeywords(lowerBody, rule.keywords, rule.matchMode);
      } else if (rule.triggerType === 'outside_business_hours') {
        // Rely on service-provided business hours status
        matches = context.isOutsideBusinessHours === true;
      } else if (rule.triggerType === 'always') {
        matches = true;
      }

      if (matches) return rule;
    }

    return null;
  }

  /**
   * Process and send the auto-reply via Monolith Bridge
   */
  static async handleMatch(rule: IAutoReplyDocument, contactId: string, conversationId: string, contactData: any = {}): Promise<boolean> {
    try {
      // 1. Throttle Check (24h Rule) - Still in local DB
      const lastLog = await AutoReplyLog.findOne({
        autoReply: rule._id,
        contact: contactId
      }).sort({ sentAt: -1 });

      if (lastLog) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (lastLog.sentAt > twentyFourHoursAgo) {
          console.log(`[AutoReply] Throttled: Rule ${rule._id} recently sent to ${contactId}`);
          return false;
        }
      }

      // 2. Prepare and Relay Message
      const actionType = (rule.replyType === 'text') ? 'send_message' : 'send_template';
      
      const payload: any = {
        workspaceId: rule.workspace,
        contactId: contactId,
        conversationId: conversationId,
        phone: contactData.phone,
        config: {
          body: rule.textMessage,
          templateName: rule.templateName,
          languageCode: rule.languageCode || 'en',
          components: rule.variableMapping // Map variables if needed
        }
      };

      await chatInternalClient.post('/api/internal/actions', {
        type: actionType,
        payload
      });

      // 3. Log & Update Stats
      await AutoReplyLog.create({
        workspace: rule.workspace,
        autoReply: rule._id,
        contact: contactId,
        sentAt: new Date()
      });

      (rule as any).totalRepliesSent = ((rule as any).totalRepliesSent || 0) + 1;
      (rule as any).lastSentAt = new Date();
      await (rule as any).save();

      return true;
    } catch (err: any) {
      console.error(`[AutoReply] Failed to send: ${err.message}`);
      return false;
    }
  }

  private static matchKeywords(body: string, keywords: string[], mode: string): boolean {
    return keywords.some(k => {
      const kw = k.toLowerCase().trim();
      if (mode === 'exact') return body === kw;
      if (mode === 'starts_with') return body.startsWith(kw);
      return body.includes(kw);
    });
  }
}
