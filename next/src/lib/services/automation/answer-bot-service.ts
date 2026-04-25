/**
 * ANSWER BOT SERVICE
 * 
 * Handles AI-powered FAQ matching and automated human escalation.
 * Implements a token-overlap fuzzy matching algorithm.
 */

import { FAQ, IFAQDocument } from "@/lib/models/shared/FAQ";
import { AnswerBotSettings } from "@/lib/models/automation/AnswerBotSettings";
import { Conversation } from "@/lib/models/messaging/Conversation";
import { WabaService } from "../messaging/waba-service";
import { Types } from "mongoose";
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { broadcastToWorkspace } from '../socket-emitter';

export class AnswerBotService {
  /**
   * Process a message and send matching FAQ response if found.
   * Handles human escalation after 3 failed intents.
   */
  static async processMessage(
    workspaceId: string | Types.ObjectId,
    messageBody: string,
    conversation: any
  ): Promise<IFAQDocument | null> {
    if (!conversation || conversation.botMetadata?.isBotPaused) return null;

    const settings = await AnswerBotSettings.findOne({ workspace: workspaceId }).lean();
    if (settings && settings.enabled === false) {
      return null;
    }

    const threshold = typeof settings?.confidenceThreshold === 'number' ? settings.confidenceThreshold : 0.5;

    const matchedFaq = await this.findMatch(workspaceId, messageBody, threshold);

    if (matchedFaq) {
      // 1. Success path: Send response
      await this.sendFaqResponse(workspaceId, conversation, matchedFaq);
      
      // Reset failed intents
      conversation.botMetadata = { ...conversation.botMetadata, failedIntents: 0, lastBotInteractionAt: new Date() };
      await conversation.save();

      // Update FAQ stats
      matchedFaq.matchCount += 1;
      matchedFaq.lastMatchedAt = new Date();
      await matchedFaq.save();

      return matchedFaq;
    }

    // 2. Failure path: Track intents and escalate
    const metadata = conversation.botMetadata || { failedIntents: 0, isBotPaused: false };
    metadata.failedIntents = (metadata.failedIntents || 0) + 1;
    metadata.lastBotInteractionAt = new Date();

    if (metadata.failedIntents >= 3) {
      metadata.isBotPaused = true;
      console.log(`[AnswerBot] 🚨 Escalating to human agent for conversation ${conversation._id}`);
      
      // Real-time notification to UI
      broadcastToWorkspace(workspaceId.toString(), 'bot:escalation', {
        conversationId: conversation._id,
        contactName: conversation.contact?.name || 'Customer',
        reason: 'Maximum failed intents reached'
      });
    }

    conversation.botMetadata = metadata;
    await conversation.save();

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
      // Match against main question
      if (this.calculateMatchScore(lowerBody, faq.question) >= threshold) return faq;

      // Match against variations
      if (faq.variations) {
        for (const v of faq.variations) {
          if (this.calculateMatchScore(lowerBody, v) >= threshold) return faq;
        }
      }
    }

    return null;
  }

  /**
   * Token overlap algorithm
   */
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
        // Partial/Fuzzy match
        if (t.startsWith(m) || m.startsWith(t)) {
          const ratio = Math.min(t.length, m.length) / Math.max(t.length, m.length);
          if (ratio >= 0.8) best = Math.max(best, ratio);
        }
      }
      matchCount += best;
    }

    return matchCount / tTokens.length;
  }

  /**
   * Send WhatsApp response (Text or Interactive)
   */
  private static async sendFaqResponse(workspaceId: string | Types.ObjectId, conversation: any, faq: IFAQDocument) {
    const to = conversation.contact?.phone || (await conversation.populate('contact')).contact.phone;
    
    // Check if we should send interactive buttons or just text
    if (faq.interactive && faq.interactive.buttons?.length > 0) {
       const interactivePayload = {
         type: faq.interactive.type || 'button',
         ...(faq.interactive.header ? { header: { type: 'text', text: faq.interactive.header } } : {}),
         body: { text: faq.interactive.body || faq.answer },
         ...(faq.interactive.footer ? { footer: { text: faq.interactive.footer } } : {}),
         action: {
           buttons: faq.interactive.buttons.map((btn, idx) => ({
             type: 'reply',
             reply: {
               id: String(btn.id || `faq_btn_${idx + 1}`),
               title: String(btn.title || `Option ${idx + 1}`).slice(0, 20)
             }
           }))
         }
       };

       await WabaService.sendInteractiveMessage(workspaceId, to, interactivePayload, {
         contactId: conversation.contact._id,
         conversationId: conversation._id,
         metadata: { source: 'answerbot', faqId: faq._id }
       });
    } else {
      await WabaService.sendTextMessage(workspaceId, to, faq.answer, {
        contactId: conversation.contact._id,
        conversationId: conversation._id
      });
    }
  }

  /**
   * Experimental: Scrape website for FAQs
   */
  static async scrapeWebsite(url: string): Promise<Array<{ question: string, answer: string }>> {
    try {
      // 1. Safety check: Head request for content-length and type
      const head = await axios.head(url, { timeout: 5000 });
      const contentType = head.headers['content-type'] || '';
      const contentLength = parseInt(head.headers['content-length'] || '0', 10);

      if (!contentType.includes('text/html')) {
        console.warn('[AnswerBot:Scrape] Unsupported content type:', contentType);
        return [];
      }

      if (contentLength > 2 * 1024 * 1024) { // 2MB Limit
        console.warn('[AnswerBot:Scrape] Page too large:', contentLength);
        return [];
      }

      const { data } = await axios.get(url, { 
        timeout: 10000,
        maxContentLength: 2 * 1024 * 1024
      });
      
      const $ = cheerio.load(data);
      const faqs: any[] = [];

      // Improved scraper logic: Look for questions in headings
      $('h1, h2, h3, h4').each((i, el) => {
        const text = $(el).text().trim();
        if (text.endsWith('?') || text.toLowerCase().startsWith('what') || text.toLowerCase().startsWith('how')) {
          const answer = $(el).next('p').text().trim() || $(el).nextUntil('h1, h2, h3, h4', 'p').text().trim();
          if (answer && answer.length > 10) {
            faqs.push({ 
              question: text, 
              answer: answer.slice(0, 1000) // Sanity limit for answers
            });
          }
        }
      });

      return faqs.slice(0, 50); // Limit to top 50 matches
    } catch (err: any) {
      if (err instanceof AxiosError && err.code === 'ECONNABORTED') {
         console.error('[AnswerBot] Scrape timed out:', url);
      } else {
         console.error('[AnswerBot] Scrape failed:', err.message || err);
      }
      return [];
    }
  }
}
