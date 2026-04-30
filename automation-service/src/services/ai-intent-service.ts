import { AutomationRule, AiIntentMatchLog } from "../models";
import { monolithClient } from "../lib/internal-client";

type IntentContext = {
  workspaceId: string;
  contactId: string;
  conversationId?: string;
  messageBody: string;
  messageId?: string;
  contact?: any;
};

/**
 * AI Intent Service (Stateless Microservice Version)
 */
export class AIIntentService {
  private static readonly MIN_CONFIDENCE = 0.5;

  static async processMessage(context: IntentContext): Promise<boolean> {
    const { workspaceId, messageBody, contactId } = context;
    if (!messageBody?.trim() || !contactId) return false;

    const rules = await AutomationRule.find({
      workspace: workspaceId,
      enabled: true,
      deletedAt: null,
      $or: [
        { "trigger.event": "ai_intent" },
        { "trigger.type": "ai_intent" }
      ]
    }).lean();

    if (!rules.length) return false;

    const ranked = rules
      .map((rule: any) => {
        const phrases = this.getTrainingPhrases(rule);
        const confidence = this.bestScore(messageBody, phrases);
        return { rule, confidence };
      })
      .sort((a, b) => b.confidence - a.confidence);

    const best = ranked[0];
    if (!best || best.confidence < this.MIN_CONFIDENCE) {
      return false;
    }

    const executed = await this.executeActions(best.rule, context);

    // Local audit logging in microservice DB
    await AiIntentMatchLog.create({
      workspace: workspaceId,
      queryText: messageBody,
      matchedRule: best.rule._id,
      confidence: best.confidence,
      conversation: context.conversationId,
      contact: contactId,
      aiMetadata: {
        model: "token-overlap-v1",
        intentDetected: best.rule?.trigger?.config?.intentLabel || best.rule?.name,
        reasoning: `Matched with confidence ${best.confidence.toFixed(2)}`
      }
    });

    return executed;
  }

  private static async executeActions(rule: any, ctx: IntentContext): Promise<boolean> {
    const actions = Array.isArray(rule.actions) ? [...rule.actions] : [];
    if (!actions.length) return false;

    actions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    let executedAny = false;

    for (const action of actions) {
      try {
        await monolithClient.post('/api/internal/actions', {
          type: action.type,
          payload: {
            workspaceId: ctx.workspaceId,
            contactId: ctx.contactId,
            conversationId: ctx.conversationId,
            phone: ctx.contact?.phone,
            config: action.config
          }
        });
        executedAny = true;
      } catch (error: any) {
        console.error(`[AIIntentService] Action relay failed (${action.type}):`, error.message);
        if (!action?.continueOnFailure) break;
      }
    }

    return executedAny;
  }

  private static getTrainingPhrases(rule: any): string[] {
    const config = rule?.trigger?.config || {};
    const phrases = Array.isArray(config.trainingPhrases) ? config.trainingPhrases : [];
    return phrases.filter((p: any) => typeof p === "string" && p.trim().length > 0);
  }

  private static bestScore(message: string, phrases: string[]): number {
    if (!phrases.length) return 0;
    let best = 0;
    for (const phrase of phrases) {
      best = Math.max(best, this.calculateScore(message, phrase));
    }
    return best;
  }

  private static calculateScore(message: string, target: string): number {
    const tokenize = (input: string) =>
      input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);

    const messageTokens = tokenize(message);
    const targetTokens = tokenize(target);

    if (!messageTokens.length || !targetTokens.length) return 0;

    let hits = 0;
    for (const t of targetTokens) {
      if (messageTokens.includes(t)) {
        hits += 1;
        continue;
      }
      const fuzzy = messageTokens.some((m) => t.startsWith(m) || m.startsWith(t));
      if (fuzzy) hits += 0.7;
    }

    return hits / targetTokens.length;
  }
}
