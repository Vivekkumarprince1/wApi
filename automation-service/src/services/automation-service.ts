
import mongoose from "mongoose";
import { AutomationRule } from "../models";
import { FlowExecutorService } from "./flow-executor";
import { AutoReplyService } from "./auto-reply-service";
import { AnswerBotService } from "./answer-bot-service";
import { AIIntentService } from "./ai-intent-service";
import { monolithClient } from "../lib/internal-client";

export interface IAutomationEvent {
  workspaceId: string;
  type: string;
  contactId: string;
  conversationId?: string;
  messageId?: string;
  metadata?: any;
  body?: string;
  depth?: number;
}

export class AutomationService {
  static async trigger(workspaceId: string, eventType: string, data: any): Promise<boolean> {
    return await this.handleEvent({
      workspaceId,
      type: eventType,
      contactId: data.contactId,
      body: data.body || "",
      metadata: data,
      depth: 0
    });
  }

  static async handleInboundMessage(event: IAutomationEvent): Promise<boolean> {
    const MAX_DEPTH = 5;
    if ((event.depth || 0) >= MAX_DEPTH) return false;

    try {
      // In microservice, we assume these are passed in or we fetch them from monolith if needed
      // For now, we rely on the event data
      const messageBody = (event.body || "").toLowerCase().trim();

      // 1. Checkout Bot (Outsourced to Monolith)
      if (event.conversationId) {
        try {
          const checkoutResponse = await monolithClient.post('/api/internal/checkout/process', {
            workspaceId: event.workspaceId,
            contactId: event.contactId,
            conversationId: event.conversationId,
            messageBody
          });
          if (checkoutResponse.data?.handled) return true;
        } catch (e) {}
      }

      // 2. Rule-based Auto Reply
      if (messageBody) {
        const handled = await this.handleRuleBasedAutoReply(event);
        if (handled) return true;
      }

      // 3. Workflows
      const flowTriggered = await this.handleEvent({
        ...event,
        type: event.type || "message_received",
        depth: (event.depth || 0) + 1,
      });

      if (flowTriggered) return true;

      // 4. FAQ Bot
      if (messageBody && event.conversationId) {
        const faqMatch = await AnswerBotService.processMessage(
          event.workspaceId,
          messageBody,
          event.conversationId
        );
        if (faqMatch) return true;
      }

      // 5. AI Intent
      if (messageBody && event.conversationId) {
        const intentHandled = await AIIntentService.processMessage({
          workspaceId: event.workspaceId,
          contactId: event.contactId,
          conversationId: event.conversationId,
          messageBody,
          messageId: event.messageId,
        });
        if (intentHandled) return true;
      }

      return false;
    } catch (err: any) {
      console.error("[AutomationService] Pipeline Error:", err);
      return false;
    }
  }

  static async handleEvent(event: IAutomationEvent): Promise<boolean> {
    try {
      const MAX_DEPTH = 5;
      if ((event.depth || 0) >= MAX_DEPTH) return false;

      const isFormReply = event.metadata?.interactiveReply?.type === "nfm_reply";
      const triggerEvents = new Set<string>([event.type, "message_received", "customer.message.received"]);
      if (isFormReply) triggerEvents.add("form_submitted");

      const rules = await AutomationRule.find({
        workspace: event.workspaceId,
        enabled: true,
        deletedAt: null,
        "trigger.event": { $in: Array.from(triggerEvents) },
      }).sort({ priority: -1 });

      if (!rules.length) return false;

      let executedAny = false;
      for (const rule of rules) {
        const ruleId = (rule as any)._id?.toString();
        
        // Basic keyword filter
        const keywordList = rule?.trigger?.filters?.keywords || [];
        if (!isFormReply && keywordList.length && event.body) {
          const bodyLower = event.body.toLowerCase();
          const matches = keywordList.some((k: string) => bodyLower.includes(k.toLowerCase()));
          if (!matches) continue;
        }

        if (rule.flowConfig?.nodes?.length) {
          executedAny = true;
          await FlowExecutorService.execute(ruleId, {
            ...event,
            eventType: isFormReply ? "form_submitted" : event.type,
            messageBody: event.body,
            depth: (event.depth || 0) + 1,
          });
        }
      }

      return executedAny;
    } catch (err: any) {
      console.error("[AutomationService] Trigger Error:", err);
      return false;
    }
  }

  private static async handleRuleBasedAutoReply(event: IAutomationEvent): Promise<boolean> {
    const message = (event.body || "").toLowerCase().trim();
    if (!message) return false;

    const rules = await AutomationRule.find({
      workspace: event.workspaceId,
      category: "auto_reply",
      enabled: true,
      deletedAt: null,
    }).sort({ priority: -1, createdAt: -1 }).lean();

    for (const rule of rules) {
      const filters = rule?.trigger?.filters || {};
      const keywords = filters.keywords || [];
      const mode = filters.keywordMatchMode || "contains";

      const matched = keywords.some((k: string) => {
        const kw = k.toLowerCase().trim();
        if (mode === "exact") return message === kw;
        if (mode === "starts_with") return message.startsWith(kw);
        return message.includes(kw);
      });

      if (!matched) continue;

      const action = rule.actions?.[0];
      if (!action) continue;

      try {
        // Delegate action to monolith
        await monolithClient.post('/api/internal/actions', {
          type: action.type,
          payload: {
            workspaceId: event.workspaceId,
            contactId: event.contactId,
            config: action.config
          }
        });
        return true;
      } catch (err) {
        console.error("Auto reply failed", err);
      }
    }
    return false;
  }
}
