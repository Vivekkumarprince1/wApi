import { FAQ, IFAQDocument } from "../models";
import { AnswerBotSettings } from "../models";
import { chatInternalClient } from "../lib/internal-client";
import { Types } from "mongoose";

/**
 * ANSWER BOT SERVICE
 * Handles AI-powered FAQ matching and automated human escalation.
 */

export class AnswerBotService {
  /**
   * Process a message and send matching FAQ response if found.
   */
  static async processMessage(
    workspaceId: string | Types.ObjectId,
    messageBody: string,
    conversation: any
  ): Promise<IFAQDocument | null> {
    if (!conversation || conversation.botMetadata?.isBotPaused) return null;

    const settings = await AnswerBotSettings.findOne({ workspace: workspaceId }).lean();
    if (settings && settings.enabled === false) return null;

    const threshold = typeof settings?.confidenceThreshold === 'number' ? settings.confidenceThreshold : 0.5;
    const matchedFaq = await this.findMatch(workspaceId, messageBody, threshold);

    if (matchedFaq) {
      // 1. Success path: Send response via Monolith Bridge
      await this.sendFaqResponse(workspaceId, conversation, matchedFaq);
      
      // Notify chat-service to update conversation metadata
      await chatInternalClient.post('/api/internal/conversations/metadata', {
        workspaceId,
        conversationId: conversation._id,
        metadata: { failedIntents: 0, lastBotInteractionAt: new Date() }
      }).catch(() => {});

      // Update FAQ stats in local DB
      matchedFaq.matchCount = (matchedFaq.matchCount || 0) + 1;
      matchedFaq.lastMatchedAt = new Date();
      await (matchedFaq as any).save();

      return matchedFaq;
    }

    // 2. Failure path: Track intents and escalate via Monolith Bridge
    const failedIntents = (conversation.botMetadata?.failedIntents || 0) + 1;
    
    if (failedIntents >= 3) {
      await chatInternalClient.post('/api/internal/actions', {
        type: 'bot_escalation',
        payload: {
          workspaceId,
          conversationId: conversation._id,
          contactName: conversation.contact?.name || 'Customer',
          reason: 'Maximum failed intents reached'
        }
      }).catch(() => {});
    } else {
      await chatInternalClient.post('/api/internal/conversations/metadata', {
        workspaceId,
        conversationId: conversation._id,
        metadata: { failedIntents, lastBotInteractionAt: new Date() }
      }).catch(() => {});
    }

    return null;
  }

  /**
   * Find matching FAQ using fuzzy token overlap
   */
  private static async findMatch(
    workspaceId: string | Types.ObjectId,
    body: string,
    threshold: number
  ): Promise<IFAQDocument | null> {
    const approvedFaqs = await FAQ.find({ workspace: workspaceId, status: 'approved', deletedAt: null });
    const lowerBody = body.toLowerCase().trim();

    for (const faq of approvedFaqs) {
      if (this.calculateMatchScore(lowerBody, faq.question) >= threshold) return faq;
      if (faq.variations) {
        for (const v of faq.variations) {
          if (this.calculateMatchScore(lowerBody, v) >= threshold) return faq;
        }
      }
    }
    return null;
  }

  private static calculateMatchScore(message: string, target: string): number {
    const tokenize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const mTokens = tokenize(message);
    const tTokens = tokenize(target);
    if (tTokens.length === 0) return 0;

    let matchCount = 0;
    for (const t of tTokens) {
      let best = 0;
      for (const m of mTokens) {
        if (t === m) {
          best = 1;
          break;
        }
        if (t.startsWith(m) || m.startsWith(t)) {
          const ratio = Math.min(t.length, m.length) / Math.max(t.length, m.length);
          if (ratio >= 0.8) best = Math.max(best, ratio);
        }
      }
      matchCount += best;
    }
    return matchCount / tTokens.length;
  }

  private static async sendFaqResponse(workspaceId: string | Types.ObjectId, conversation: any, faq: IFAQDocument) {
    const phone = conversation.contact?.phone;
    if (!phone) return;

    await chatInternalClient.post('/api/internal/actions', {
      type: 'send_message',
      payload: {
        workspaceId,
        phone,
        contactId: conversation.contact?._id,
        conversationId: conversation._id,
        config: { body: faq.answer }
      }
    });
  }
}
