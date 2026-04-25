import { AutomationRule, AiIntentMatchLog } from "@/lib/models";
import { WabaService } from "@/lib/services/messaging/waba-service";

type IntentContext = {
  workspaceId: string;
  contact: any;
  conversation: any;
  messageBody: string;
  messageId?: string;
};

/**
 * AI Intent Service
 * Matches free-form inbound text to configured AI intent rules using token overlap scoring.
 */
export class AIIntentService {
  private static readonly MIN_CONFIDENCE = 0.5;

  static async processMessage(context: IntentContext): Promise<boolean> {
    const { workspaceId, contact, conversation, messageBody } = context;
    if (!messageBody?.trim() || !contact?.phone) return false;

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

    const executed = await this.executeActions(best.rule, {
      workspaceId,
      contact,
      conversation,
      messageBody,
      confidence: best.confidence
    });

    await AiIntentMatchLog.create({
      workspace: workspaceId,
      queryText: messageBody,
      matchedRule: best.rule._id,
      confidence: best.confidence,
      conversation: conversation?._id,
      contact: contact?._id,
      aiMetadata: {
        model: "token-overlap-v1",
        intentDetected: best.rule?.trigger?.config?.intentLabel || best.rule?.name,
        reasoning: `Matched with confidence ${best.confidence.toFixed(2)}`
      }
    });

    return executed;
  }

  private static async executeActions(rule: any, ctx: any): Promise<boolean> {
    const actions = Array.isArray(rule.actions) ? [...rule.actions] : [];
    if (!actions.length) return false;

    actions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    let executedAny = false;

    for (const action of actions) {
      const type = action?.type;
      const config = action?.config || {};

      try {
        if (type === "send_message") {
          const body = config.body || config.message || "Thanks for your message.";
          await WabaService.sendTextMessage(
            ctx.workspaceId,
            ctx.contact.phone,
            body,
            {
              contactId: ctx.contact._id,
              conversationId: ctx.conversation?._id,
              metadata: { source: "ai_intent", ruleId: rule._id }
            }
          );
          executedAny = true;
          continue;
        }

        if (type === "send_template") {
          if (!config.templateName) continue;
          await WabaService.sendTemplateMessage(
            ctx.workspaceId,
            ctx.contact.phone,
            config.templateName,
            config.languageCode || "en_US",
            config.components || [],
            {
              contactId: ctx.contact._id,
              conversationId: ctx.conversation?._id,
              metadata: { source: "ai_intent", ruleId: rule._id }
            }
          );
          executedAny = true;
          continue;
        }
      } catch (error: any) {
        console.error(`[AIIntentService] Action failed (${type}):`, error.message);
        if (!action?.continueOnFailure) {
          break;
        }
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
      input
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2);

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