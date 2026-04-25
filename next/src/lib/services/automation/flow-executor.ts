import {
  AutomationRule,
  AutomationExecution,
  Contact,
  Conversation,
  Pipeline
} from "@/lib/models";
import { WabaService } from "@/lib/services/messaging/waba-service";
import { SafetyGuards } from "@/lib/services/automation/safety-guards";
import { DealService } from "@/lib/services/commerce/deal-service";
import dbConnect from "@/lib/db-connect";

/**
 * FLOW EXECUTOR SERVICE
 * Handles traversing the visual workflow graph and executing actions.
 * Includes actual WhatsApp message dispatch, safety checks, and robust execution logging.
 */

export class FlowExecutorService {
  /**
   * Main entry point to execute a workflow graph
   */
  static async execute(ruleId: string, context: any) {
    const startTime = Date.now();
    await dbConnect();

    let rule: any;
    let execution: any;

    try {
      rule = await AutomationRule.findById(ruleId);
      if (!rule || !rule.flowConfig) {
        console.error(`[FlowExecutor] Rule not found or no flowConfig: ${ruleId}`);
        return;
      }

      const { nodes, edges } = rule.flowConfig;
      if (!nodes || nodes.length === 0) {
        console.error(`[FlowExecutor] Rule has no nodes: ${ruleId}`);
        return;
      }

      const getEffectiveNodeType = (node: any): string => {
        const candidate =
          node?.type ||
          node?.data?.type ||
          node?.data?.actionType ||
          node?.data?.config?.type;
        return FlowExecutorService.normalizeNodeType(candidate);
      };

      // Fetch full contact object if only contactId provided
      let contact = context.contact;
      if (context.contactId && !contact) {
        contact = await Contact.findById(context.contactId).lean();
        context.contact = contact;
      }

      if (!contact || !contact.phone) {
        console.error(`[FlowExecutor] No contact or phone number in context`);
        return;
      }

      // 1. Initialize Execution Log
      execution = await AutomationExecution.create({
        rule: rule._id,
        ruleName: rule.name,
        workspace: rule.workspace,
        triggerEvent: context.eventType,
        contact: context.contactId,
        conversation: context.conversationId,
        status: 'pending',
        startedAt: new Date(),
        actionResults: [],
        isDryRun: context.isDryRun || false,
        contextSnapshot: {
          contactPhone: contact.phone,
          eventType: context.eventType,
          timestamp: new Date()
        }
      } as any);

      const visited = new Set<string>();
      let currentNode = context?.startNodeId
        ? nodes.find((n: any) => n.id === context.startNodeId)
        : null;

      if (!currentNode) {
        currentNode = nodes.find((n: any) => getEffectiveNodeType(n) === 'triggerNode');
      }

      if (!currentNode) {
        throw new Error("Workflow has no trigger node");
      }

      // 2. Graph Traversal Loop
      while (currentNode) {
        if (visited.has(currentNode.id)) {
          console.warn(`[FlowExecutor] Loop detected at node ${currentNode.id}`);
          break;
        }
        visited.add(currentNode.id);

        // A. Skip trigger node processing
        const skipNodeExecution =
          !!context?.skipCurrentNodeExecution &&
          context?.startNodeId &&
          currentNode.id === context.startNodeId;

        const normalizedCurrentType = getEffectiveNodeType(currentNode);

        if (normalizedCurrentType !== 'triggerNode' && !skipNodeExecution) {
          const actionStart = Date.now();

          try {
            // Run safety checks BEFORE execution
            const safetyResult = await SafetyGuards.runSafetyChecks(
              rule,
              context.contactId,
              context.conversationId
            );

            if (!safetyResult.pass) {
              // Skip due to safety checks
              execution.actionResults.push({
                actionType: currentNode?.type || 'unknown',
                actionIndex: visited.size,
                status: 'SKIPPED',
                error: safetyResult.reason,
                durationMs: Date.now() - actionStart,
                executedAt: new Date()
              } as any);

              console.info(
                `[FlowExecutor] Skipped node ${currentNode.id} due to safety check: ${safetyResult.reason}`
              );

              // Continue to next node if continueOnFailure is true
              if (!currentNode.data.continueOnFailure) break;
            } else {
              // Proceed with execution
              const result = await this.executeNode(
                { ...currentNode, type: normalizedCurrentType },
                context,
                rule.workspace.toString()
              );

              execution.actionResults.push({
                actionType: currentNode?.type || 'unknown',
                actionIndex: visited.size,
                status: 'SUCCESS',
                result,
                durationMs: Date.now() - actionStart,
                executedAt: new Date()
              } as any);

              console.info(
                `[FlowExecutor] Successfully executed node ${currentNode.id} (${currentNode.type})`
              );
            }
          } catch (err: any) {
            execution.actionResults.push({
              actionType: currentNode?.type || 'unknown',
              actionIndex: visited.size,
              status: 'FAILED',
              error: err.message,
              durationMs: Date.now() - actionStart,
              executedAt: new Date()
            } as any);

            console.error(
              `[FlowExecutor] Failed to execute node ${currentNode.id}:`,
              err.message
            );

            if (!currentNode.data.continueOnFailure) {
              throw err; // Stop execution
            }
          }
        }

        // B. Determine next node
        const outgoingEdges = edges.filter((e: any) => e.source === currentNode?.id);
        if (outgoingEdges.length === 0) break;

        let nextNodeId: string | null = null;

        if (normalizedCurrentType === 'logicNode') {
          const isMatch = await this.evaluateLogic(currentNode, context);
          const edge = outgoingEdges.find(
            (e: any) => e.sourceHandle === (isMatch ? 'true' : 'false')
          );
          nextNodeId = edge?.target || null;
        } else {
          // Sequential
          nextNodeId = outgoingEdges[0].target;
        }

        currentNode = nodes.find((n: any) => n.id === nextNodeId) || null;
      }

      // 3. Calculate execution summary
      const succeeded = execution.actionResults.filter(
        (r: any) => r.status === 'SUCCESS'
      ).length;
      const failed = execution.actionResults.filter(
        (r: any) => r.status === 'FAILED'
      ).length;
      const skipped = execution.actionResults.filter(
        (r: any) => r.status === 'SKIPPED'
      ).length;

      // 4. Complete Execution Log
      execution.status =
        failed > 0 && succeeded === 0 ? 'FAILED' :
        skipped > 0 ? 'PARTIAL' : 'SUCCESS';
      execution.completedAt = new Date();
      execution.durationMs = Date.now() - startTime;
      execution.actionsExecuted = execution.actionResults.length;
      execution.actionsSucceeded = succeeded;
      execution.actionsFailed = failed;

      // Update rule stats
      if (!rule.stats) rule.stats = { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0, skippedExecutions: 0 };
      rule.stats.totalExecutions += 1;
      if (execution.status === 'SUCCESS') {
        rule.stats.successfulExecutions += 1;
      } else if (execution.status === 'FAILED') {
        rule.stats.failedExecutions += 1;
      } else if (execution.status === 'PARTIAL') {
        rule.stats.skippedExecutions += 1;
      }
      rule.stats.lastExecutedAt = new Date();
      await rule.save();

      await execution.save();

      console.info(
        `[FlowExecutor] Execution completed for rule ${rule._id}: status=${execution.status}, duration=${execution.durationMs}ms`
      );

      return {
        success: execution.status === 'SUCCESS' || execution.status === 'PARTIAL',
        status: execution.status,
        executionId: execution._id?.toString(),
        actionsExecuted: execution.actionsExecuted,
        actionsSucceeded: execution.actionsSucceeded,
        actionsFailed: execution.actionsFailed,
        durationMs: execution.durationMs
      };
    } catch (err: any) {
      console.error("[FlowExecutor Critical Error]:", err.message, err.stack);

      if (execution) {
        execution.status = 'FAILED';
        execution.failureReason = err.code || 'INTERNAL_ERROR';
        execution.failureDetails = err.message;
        execution.completedAt = new Date();
        execution.durationMs = Date.now() - startTime;
        await execution.save();
      }

      // Log error to rule stats
      if (rule) {
        if (!rule.stats) rule.stats = { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0, skippedExecutions: 0 };
        rule.stats.totalExecutions += 1;
        rule.stats.failedExecutions += 1;
        await rule.save();
      }

      return {
        success: false,
        status: 'FAILED',
        error: err.message
      };
    }
  }

  /**
   * Execute action for a specific node type
   * Handles messageNode (text) and templateNode (template) with actual WhatsApp dispatch
   */
  private static async executeNode(
    node: any,
    context: any,
    workspaceId: string
  ): Promise<any> {
    const type = this.normalizeNodeType(
      node?.type ||
      node?.data?.type ||
      node?.data?.actionType ||
      node?.data?.config?.type
    );
    const data = node.data || {};
    const actionConfig = data.config || {};
    const contact = context.contact;
    const contactPhone = contact.phone;
    const contactId = context.contactId || context.contact?._id;

    if (!contactPhone) {
      throw new Error('MISSING_CONTACT_PHONE');
    }

    if (!workspaceId) {
      throw new Error('MISSING_WORKSPACE_ID');
    }

    switch (type) {
      case 'messageNode': {
        // Text message execution
        const textBody =
          data.messageContent ||
          data.body ||
          data.message ||
          actionConfig.messageContent ||
          actionConfig.body ||
          actionConfig.message;
        if (!textBody) {
          throw new Error('MESSAGE_CONTENT_MISSING');
        }

        const messageContent = this.resolveTemplateVariables(
          textBody,
          context
        );

        console.info(
          `[FlowExecutor] Sending text message to ${contactPhone}: "${messageContent}"`
        );

        const result = await WabaService.sendTextMessage(
          workspaceId,
          contactPhone,
          messageContent
        );

        if (!result.success) {
          throw new Error(
            `TEXT_MESSAGE_FAILED: ${result.result?.error || 'Unknown error'}`
          );
        }

        return {
          type: 'messageNode',
          success: true,
          messageSent: true,
          whatsappMessageId: (result.result as any)?.messageId || result.message?.whatsappMessageId,
          content: messageContent,
          recipient: contactPhone
        };
      }

      case 'send_message':
      case 'send_text':
        return this.executeNode({ ...node, type: 'messageNode' }, context, workspaceId);

      case 'templateNode': {
        // Template message execution
        const templateName = data.templateName || data.name || actionConfig.templateName;
        if (!templateName) {
          throw new Error('TEMPLATE_NAME_MISSING');
        }

        const languageCode = data.languageCode || actionConfig.languageCode || 'en_US';
        const templateParams = data.templateParams || actionConfig.templateParams || actionConfig.components || [];

        console.info(
          `[FlowExecutor] Sending template message to ${contactPhone}: "${templateName}"`
        );

        const result = await WabaService.sendTemplateMessage(
          workspaceId,
          contactPhone,
          templateName,
          languageCode,
          templateParams
        );

        if (!result.success) {
          throw new Error(
            `TEMPLATE_MESSAGE_FAILED: ${result.result?.error || 'Unknown error'}`
          );
        }

        return {
          type: 'templateNode',
          success: true,
          templateSent: true,
          whatsappMessageId: (result.result as any)?.messageId || result.message?.whatsappMessageId,
          templateName: templateName,
          recipient: contactPhone
        };
      }

      case 'send_template':
        return this.executeNode({ ...node, type: 'templateNode' }, context, workspaceId);

      case 'interactiveNode': {
        const interactivePayload =
          data.interactive ||
          actionConfig.interactive ||
          {
            type: 'button',
            body: { text: data.body || actionConfig.body || 'Choose an option' },
            action: {
              buttons: (data.buttons || actionConfig.buttons || []).map((btn: any, idx: number) => ({
                type: 'reply',
                reply: {
                  id: String(btn?.id || `btn_${idx + 1}`),
                  title: String(btn?.title || btn?.text || `Option ${idx + 1}`)
                }
              }))
            }
          };

        const result = await WabaService.sendInteractiveMessage(
          workspaceId,
          contactPhone,
          interactivePayload,
          {
            contactId,
            conversationId: context.conversationId,
            metadata: { source: 'workflow', nodeId: node.id }
          }
        );

        if (!result.success) {
          throw new Error(
            `INTERACTIVE_MESSAGE_FAILED: ${result.result?.error || 'Unknown error'}`
          );
        }

        return {
          type: 'interactiveNode',
          success: true,
          whatsappMessageId: result.result?.messageId,
          recipient: contactPhone
        };
      }

      case 'send_interactive':
        return this.executeNode({ ...node, type: 'interactiveNode' }, context, workspaceId);

      case 'flowNode': {
        const flowPayload =
          data.flow ||
          actionConfig.flow ||
          {
            body: { text: data.body || actionConfig.body || 'Please complete this flow' },
            action: data.action || actionConfig.action || {}
          };

        if (!flowPayload?.action) {
          throw new Error('FLOW_ACTION_MISSING');
        }

        // Deep-resolve template variables in flowPayload
        const resolveObject = (obj: any): any => {
          if (typeof obj === 'string') return this.resolveTemplateVariables(obj, context);
          if (Array.isArray(obj)) return obj.map(item => resolveObject(item));
          if (obj !== null && typeof obj === 'object') {
            const resolved: any = {};
            for (const k in obj) resolved[k] = resolveObject(obj[k]);
            return resolved;
          }
          return obj;
        };

        const resolvedFlowPayload = resolveObject(flowPayload);

        const result = await WabaService.sendFlowMessage(
          workspaceId,
          contactPhone,
          resolvedFlowPayload,
          {
            contactId,
            conversationId: context.conversationId,
            metadata: { source: 'workflow', nodeId: node.id }
          }
        );

        if (!result.success) {
          throw new Error(
            `FLOW_MESSAGE_FAILED: ${result.result?.error || 'Unknown error'}`
          );
        }

        return {
          type: 'flowNode',
          success: true,
          whatsappMessageId: result.result?.messageId,
          recipient: contactPhone
        };
      }

      case 'send_flow':
        return this.executeNode({ ...node, type: 'flowNode' }, context, workspaceId);

      case 'addTagNode':
      case 'add_tag': {
        const tag = String(data.tag || data.tagName || actionConfig.tag || actionConfig.tagName || '').trim();
        if (!tag || !contactId) {
          throw new Error('ADD_TAG_CONFIG_MISSING');
        }

        await Contact.findByIdAndUpdate(contactId, {
          $addToSet: { tags: tag }
        });

        return {
          type,
          success: true,
          tagAdded: tag,
          contactId: String(contactId)
        };
      }

      case 'assignConversationNode':
      case 'assign_conversation': {
        const assignedTo =
          data.assignedTo ||
          data.assignedAgentId ||
          data.agentId ||
          actionConfig.assignedTo ||
          actionConfig.assignedAgentId ||
          actionConfig.agentId ||
          actionConfig.assignTo?.agentId;
        if (!context.conversationId || !assignedTo) {
          throw new Error('ASSIGN_CONVERSATION_CONFIG_MISSING');
        }

        await Conversation.findByIdAndUpdate(context.conversationId, {
          assignedTo,
          assignedBy: data.assignedBy || data.actorId,
          assignedAt: new Date()
        });

        return {
          type,
          success: true,
          conversationId: String(context.conversationId),
          assignedTo: String(assignedTo)
        };
      }

      case 'createDealNode':
      case 'create_deal': {
        if (!contactId) {
          throw new Error('CREATE_DEAL_CONTACT_MISSING');
        }

        let pipelineId = data.pipelineId || actionConfig.pipelineId;
        if (!pipelineId) {
          const fallbackPipeline = await Pipeline.findOne({
            workspace: workspaceId,
            isDefault: true
          }).select('_id').lean() || await Pipeline.findOne({
            workspace: workspaceId
          }).sort({ createdAt: 1 }).select('_id').lean();

          pipelineId = fallbackPipeline?._id?.toString();
        }

        if (!pipelineId) {
          throw new Error('CREATE_DEAL_PIPELINE_MISSING');
        }

        const deal = await DealService.createDeal(workspaceId, {
          contactId,
          pipelineId,
          title: data.title || actionConfig.title || actionConfig.dealTitle || `Workflow Deal: ${contact.name || contact.phone}`,
          value: Number(data.value || actionConfig.value || actionConfig.dealValue || 0),
          currency: data.currency || actionConfig.currency || 'USD',
          stage: data.stage || data.stageId || actionConfig.stage || actionConfig.stageId,
          assignedAgent: data.assignedAgent || data.assignedAgentId || actionConfig.assignedAgent || actionConfig.assignedAgentId,
          source: 'workflow'
        });

        return {
          type,
          success: true,
          dealId: deal._id?.toString(),
          pipelineId: String(pipelineId)
        };
      }

      default:
        console.warn(`[FlowExecutor] Unhandled node type: ${type}`);
        return { status: 'skipped', reason: 'unhandled_node_type', nodeType: type };
    }
  }

  /**
   * Evaluate branching logic for a LogicNode
   */
  private static async evaluateLogic(
    node: any,
    context: any
  ): Promise<boolean> {
    const nodeData = node.data || {};
    const nodeConfig = nodeData.config || {};
    const conditionField = nodeData.conditionField || nodeData.field || nodeConfig.conditionField || nodeConfig.field;
    const operator = nodeData.operator || nodeConfig.operator;
    const value = nodeData.value ?? nodeData.conditionValue ?? nodeConfig.value;
    if (!conditionField) return false;

    const resolvePath = (obj: any, path: string): any => {
      if (!obj || !path) return undefined;
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current == null) return undefined;
        current = current[part];
      }
      return current;
    };

    // Support direct fields (messageBody), nested fields (contact.name), and fallback lookup
    const actualValue =
      resolvePath(context, conditionField) ??
      resolvePath(context.contact, conditionField) ??
      resolvePath(context.conversation, conditionField);

    if (operator === 'contains') {
      return String(actualValue)
        .toLowerCase()
        .includes(String(value).toLowerCase());
    }

    if (operator === 'equals') {
      return String(actualValue).toLowerCase() === String(value).toLowerCase();
    }

    if (operator === 'startsWith' || operator === 'starts_with') {
      return String(actualValue)
        .toLowerCase()
        .startsWith(String(value).toLowerCase());
    }

    if (operator === 'exists') {
      return !!actualValue;
    }

    return !!actualValue;
  }

  /**
   * Normalize various node type aliases into a canonical type
   */
  private static normalizeNodeType(rawType: string): string {
    const t = String(rawType || '').toLowerCase();
    if (t === 'trigger' || t === 'triggernode') return 'triggerNode';
    if (t === 'condition' || t === 'logic' || t === 'logicnode') return 'logicNode';
    if (t === 'message' || t === 'messagenode' || t === 'send_message' || t === 'send_text' || t === 'send_text_message' || t === 'send_text') return 'messageNode';
    if (t === 'template' || t === 'templatenode' || t === 'send_template' || t === 'send_template_message') return 'templateNode';
    if (t === 'interactive' || t === 'interactivenode' || t === 'send_interactive' || t === 'send_interactive_message') return 'interactiveNode';
    if (t === 'flow' || t === 'flownode' || t === 'send_flow' || t === 'send_flow_message') return 'flowNode';
    if (t === 'addtagnode' || t === 'add_tag') return 'add_tag';
    if (t === 'assignconversationnode' || t === 'assign_conversation') return 'assign_conversation';
    if (t === 'createdealnode' || t === 'create_deal') return 'create_deal';
    return rawType;
  }

  /**
   * Resolve template variables in message content
   * e.g., "Hello {{contact.name}}" -> "Hello John"
   */
  private static resolveTemplateVariables(
    template: string,
    context: any
  ): string {
    if (!template || typeof template !== 'string') return template;

    return template.replace(/\{\{([^{}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let current = context;

      // Handle common shorthands if path starts with contact or conversation
      // But the root context already contains them, so the reducer should work.
      
      for (const part of parts) {
        if (current == null) return match;
        current = current[part];
      }

      return current !== undefined && current !== null ? String(current) : match;
    });
  }
}
