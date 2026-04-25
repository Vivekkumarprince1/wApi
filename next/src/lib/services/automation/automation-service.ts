import mongoose from "mongoose";
import { AutomationRule, Contact, Conversation, Workspace } from "@/lib/models";
import { FlowExecutorService } from "./flow-executor";
import { CheckoutBotService } from "../commerce/checkout-bot-service";
import { AutoReplyService } from "./auto-reply-service";
import { AnswerBotService } from "./answer-bot-service";
import { AIIntentService } from "./ai-intent-service";
import { WabaService } from "../messaging/waba-service";
import { WhatsAppFormService } from "../commerce/whatsapp-form-service";
import dbConnect from "@/lib/db-connect";

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
  /**
   * Main entry point for triggering automations from external events
   * Bridging IntegrationOrchestrator to AutomationEngine
   */
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
    await dbConnect();

    const MAX_DEPTH = 5;
    if ((event.depth || 0) >= MAX_DEPTH) return false;

    try {
      const workspace = await Workspace.findById(event.workspaceId).lean();
      if (!workspace) return false;

      const contact = await Contact.findById(event.contactId).lean();
      if (!contact) return false;

      const conversation = event.conversationId
        ? await Conversation.findById(event.conversationId)
          .populate("contact")
          .exec()
        : null;

      const messageBody = (event.body || "").toLowerCase().trim();

      // 1. Checkout Bot
      if (event.conversationId && CheckoutBotService?.processMessage) {
        const checkoutResult = await CheckoutBotService.processMessage(
          event.workspaceId,
          event.contactId,
          event.conversationId,
          messageBody
        );
        if (checkoutResult?.handled) return true;
      }

      // 2. Rule-based Auto Reply
      if (messageBody) {
        const handled = await this.handleRuleBasedAutoReply(
          event,
          contact,
          conversation
        );
        if (handled) return true;
      }

      // 2b. Legacy AutoReply
      if (messageBody && conversation?._id) {
        const match = await AutoReplyService.findMatch(
          messageBody,
          event.workspaceId
        );
        if (match) {
          const handled = await AutoReplyService.handleMatch(
            match,
            contact as any,
            conversation._id as any
          );
          if (handled) return true;
        }
      }

      // 3. Workflows (FIXED)
      const flowTriggered = await this.handleEvent({
        ...event,
        type: event.type || "message_received",
        depth: (event.depth || 0) + 1,
      });

      if (flowTriggered) return true;

      // 4. FAQ Bot
      if (messageBody && conversation) {
        const faqMatch = await AnswerBotService.processMessage(
          event.workspaceId,
          messageBody,
          conversation
        );
        if (faqMatch) return true;
      }

      // 5. AI Intent
      if (
        workspace?.automationSettings?.aiIntentMatchEnabled !== false &&
        messageBody &&
        conversation
      ) {
        const intentHandled = await AIIntentService.processMessage({
          workspaceId: event.workspaceId,
          contact,
          conversation,
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
      await dbConnect();

      const MAX_DEPTH = 5;
      if ((event.depth || 0) >= MAX_DEPTH) return false;

      const isFormReply =
        event.metadata?.interactiveReply?.type === "nfm_reply";

      const submittedFlowId = isFormReply
        ? String(event.metadata?.interactiveReply?.flowId || "")
        : "";

      const submittedFlowToken = isFormReply
        ? String(
          event.metadata?.interactiveReply?.flowToken || submittedFlowId
        )
        : "";

      const submittedFormData = isFormReply
        ? event.metadata?.interactiveReply?.data || {}
        : null;

      const triggerEvents = new Set<string>([
        event.type,
        "message_received",
        "customer.message.received",
      ]);

      if (isFormReply) triggerEvents.add("form_submitted");

      const rules = await AutomationRule.find({
        workspace: event.workspaceId,
        enabled: true,
        deletedAt: null,
        "trigger.event": { $in: Array.from(triggerEvents) },
      }).sort({ priority: -1 });

      if (!rules.length) return false;

      const context = await this.enrichContext(event);

      if (isFormReply) context.formSubmission = submittedFormData;

      const resumeNodeMap = isFormReply
        ? this.findFormResumeNodes(rules as any[], submittedFlowId)
        : new Map<string, string>();

      // Save form submission
      if (isFormReply && submittedFlowId) {
        await WhatsAppFormService.recordSubmission(
          event.workspaceId,
          event.contactId,
          submittedFlowToken,
          submittedFormData,
          undefined,
          {
            conversationId: event.conversationId,
            messageId: event.messageId,
          }
        );
      }

      let executedAny = false;

      for (const rule of rules) {
        const ruleId = rule._id?.toString();
        if (!ruleId) continue;

        const resumeNodeId = resumeNodeMap.get(ruleId);

        // Resume flow after form
        if (isFormReply && submittedFlowId) {
          if (resumeNodeId) {
            if (!this.evaluatePreConditions(rule, context)) continue;

            executedAny = true;

            await FlowExecutorService.execute(ruleId, {
              ...context,
              eventType: "form_submitted",
              messageBody: event.body,
              startNodeId: resumeNodeId,
            });

            continue;
          }

          if (rule.trigger?.event !== "form_submitted") continue;
        }

        // Keyword filter
        const keywordList =
          rule?.trigger?.filters?.keywords || [];

        if (
          !isFormReply &&
          keywordList.length &&
          event.body
        ) {
          const bodyLower = event.body.toLowerCase();
          const matches = keywordList.some((k: string) =>
            bodyLower.includes(k.toLowerCase())
          );
          if (!matches) continue;
        }

        // CRM stage filter
        if (event.type === "crm_deal_stage_changed") {
          const ruleStageId = rule.trigger?.config?.stageId;
          const targetStageId = event.metadata?.toStage;

          if (ruleStageId && targetStageId && ruleStageId !== targetStageId) {
            continue;
          }
        }

        if (!this.evaluatePreConditions(rule, context)) continue;

        if (rule.flowConfig?.nodes?.length) {
          executedAny = true;

          await FlowExecutorService.execute(ruleId, {
            ...context,
            eventType: isFormReply ? "form_submitted" : event.type,
            messageBody: event.body,
            depth: (event.depth || 0) + 1,
          });
        } else if (rule.actions?.length) {
          try {
            const { SimpleActionExecutor } = await import(
              "./simple-action-executor"
            );

            executedAny = true;

            await SimpleActionExecutor.execute(rule, {
              ...context,
              ruleId,
            });
          } catch (err) {
            console.error("SimpleActionExecutor error", err);
          }
        }
      }

      return executedAny;
    } catch (err: any) {
      console.error("[AutomationService] Trigger Error:", err);
      return false;
    }
  }

  private static async enrichContext(event: IAutomationEvent) {
    const context: any = { ...event };

    if (event.contactId) {
      context.contact = await Contact.findById(event.contactId).lean();
    }

    if (event.conversationId) {
      context.conversation = await Conversation.findById(
        event.conversationId
      ).lean();
    }

    return context;
  }

  private static async handleRuleBasedAutoReply(
    event: IAutomationEvent,
    contact: any,
    conversation: any
  ): Promise<boolean> {
    const message = (event.body || "").toLowerCase().trim();
    if (!message || !conversation?._id) return false;

    const rules = await AutomationRule.find({
      workspace: event.workspaceId,
      category: "auto_reply",
      enabled: true,
      deletedAt: null,
    })
      .sort({ priority: -1, createdAt: -1 })
      .lean();

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
        if (action.type === "send_template") {
          await WabaService.sendTemplateMessage(
            event.workspaceId,
            contact.phone,
            action.config.templateName,
            action.config.languageCode || "en_US",
            action.config.components || []
          );
          return true;
        }

        if (action.type === "send_message") {
          await WabaService.sendTextMessage(
            event.workspaceId,
            contact.phone,
            action.config.body || "Thanks!",
            {
              contactId: contact._id,
              conversationId: conversation._id,
            }
          );
          return true;
        }
      } catch (err) {
        console.error("Auto reply failed", err);
      }
    }

    return false;
  }

  // SAME as your original (no change)
  private static evaluatePreConditions(rule: any, context: any): boolean {
    if (!rule?.conditions?.length) return true;

    return rule.conditions.every((c: any) => {
      const val = context?.[c.field];
      return String(val) === String(c.value);
    });
  }

  private static findFormResumeNodes(
    rules: any[],
    submittedFlowId: string
  ): Map<string, string> {
    const map = new Map<string, string>();
    if (!submittedFlowId) return map;

    for (const rule of rules) {
      const nodes = rule?.flowConfig?.nodes || [];
      const edges = rule?.flowConfig?.edges || [];

      for (const node of nodes) {
        if (node?.type !== "send_form") continue;

        const nodeFlowId =
          node?.data?.flowId ||
          node?.data?.formId ||
          node?.data?.whatsappFlowId;

        if (nodeFlowId !== submittedFlowId) continue;

        const nextEdge = edges.find((e: any) => e.source === node.id);

        if (nextEdge?.target) {
          map.set(rule._id.toString(), nextEdge.target);
        }
      }
    }

    return map;
  }
}