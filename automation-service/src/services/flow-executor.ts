import {
  AutomationRule,
  AutomationExecution
} from "../models";
import { monolithClient } from "../lib/internal-client";
import { SafetyGuards } from "./safety-guards";

/**
 * FLOW EXECUTOR SERVICE (Microservice Version)
 * Handles traversing the visual workflow graph and executing actions.
 * Outsourced side-effects (sending messages, updating DB) to the Monolith via Bridge.
 */

export class FlowExecutorService {
  /**
   * Main entry point to execute a workflow graph
   */
  static async execute(ruleId: string, context: any) {
    const startTime = Date.now();

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

      // 1. Initialize Execution Log (Stored in Automation DB)
      execution = await AutomationExecution.create({
        rule: rule._id,
        ruleName: rule.name,
        workspace: rule.workspace,
        triggerEvent: context.eventType,
        contact: context.contactId,
        conversation: context.conversationId,
        status: 'PENDING',
        startedAt: new Date(),
        actionResults: [],
        isDryRun: context.isDryRun || false,
        contextSnapshot: context // Store full snapshot for audit
      } as any);

      // Publish event: Workflow Started
      const { publishEvent } = await import("../lib/redis");
      await publishEvent('automation:events', 'workflow_started', rule.workspace.toString(), {
        executionId: execution._id.toString(),
        ruleName: rule.name
      });

      const visited = new Set<string>();
      let currentNode = context?.startNodeId
        ? nodes.find((n: any) => n.id === context.startNodeId)
        : null;

      if (!currentNode) {
        currentNode = nodes.find((n: any) => getEffectiveNodeType(n) === 'triggerNode');
      }

      if (!currentNode) throw new Error("Workflow has no trigger node");

      // 2. Graph Traversal Loop
      while (currentNode) {
        if (visited.has(currentNode.id)) break;
        visited.add(currentNode.id);

        const normalizedCurrentType = getEffectiveNodeType(currentNode);

        if (normalizedCurrentType !== 'triggerNode') {
          const actionStart = Date.now();

          try {
            // Proceed with execution (Outsourced to Monolith Bridge)
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

          } catch (err: any) {
            execution.actionResults.push({
              actionType: currentNode?.type || 'unknown',
              actionIndex: visited.size,
              status: 'FAILED',
              error: err.message,
              durationMs: Date.now() - actionStart,
              executedAt: new Date()
            } as any);

            if (!currentNode.data?.continueOnFailure) throw err;
          }
        }

        // B. Determine next node
        const outgoingEdges = edges.filter((e: any) => e.source === currentNode?.id);
        if (outgoingEdges.length === 0) break;

        let nextNodeId: string | null = null;

        if (normalizedCurrentType === 'logicNode') {
          const isMatch = await this.evaluateLogic(currentNode, context);
          const edge = outgoingEdges.find((e: any) => e.sourceHandle === (isMatch ? 'true' : 'false'));
          nextNodeId = edge?.target || null;
        } else {
          nextNodeId = outgoingEdges[0].target;
        }

        currentNode = nodes.find((n: any) => n.id === nextNodeId) || null;
      }

      // 3. Calculation & Update
      execution.status = 'SUCCESS';
      execution.completedAt = new Date();
      execution.durationMs = Date.now() - startTime;
      await execution.save();

      // Publish event: Workflow Completed
      await publishEvent('automation:events', 'workflow_completed', rule.workspace.toString(), {
        executionId: execution._id.toString(),
        ruleName: rule.name,
        status: 'SUCCESS'
      });

      return { success: true, executionId: execution._id?.toString() };
    } catch (err: any) {
      console.error("[FlowExecutor Critical Error]:", err.message);
      if (execution) {
        execution.status = 'FAILED';
        execution.completedAt = new Date();
        await execution.save();

        const { publishEvent } = await import("../lib/redis");
        await publishEvent('automation:events', 'workflow_completed', rule.workspace.toString(), {
          executionId: execution._id.toString(),
          ruleName: rule?.name || 'Unknown',
          status: 'FAILED',
          error: err.message
        });
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Execute action (Relays to Monolith Bridge)
   */
  private static async executeNode(node: any, context: any, workspaceId: string): Promise<any> {
    const type = this.normalizeNodeType(node?.type || node?.data?.type || node?.data?.actionType || node?.data?.config?.type);

    // Most actions are now sent to the Monolith Bridge
    const bridgeActions = ['messageNode', 'templateNode', 'interactiveNode', 'flowNode', 'add_tag', 'assign_conversation', 'create_deal'];

    if (bridgeActions.includes(type)) {
      const response = await monolithClient.post('/api/internal/actions', {
        type: type === 'messageNode' ? 'send_message' :
          type === 'templateNode' ? 'send_template' : type,
        payload: {
          workspaceId,
          contactId: context.contactId,
          conversationId: context.conversationId,
          phone: context.phone || context.contact?.phone,
          config: node.data?.config || node.data || {}
        }
      });
      return response.data;
    }

    return { skipped: true, reason: 'unhandled_type' };
  }

  private static async evaluateLogic(node: any, context: any): Promise<boolean> {
    const nodeData = node.data || {};
    const conditionField = nodeData.field || nodeData.config?.field;
    const operator = nodeData.operator || nodeData.config?.operator;
    const value = nodeData.value ?? nodeData.config?.value;

    if (!conditionField) return false;

    const actualValue = context[conditionField] || context.contact?.[conditionField];

    if (operator === 'equals') return String(actualValue).toLowerCase() === String(value).toLowerCase();
    if (operator === 'contains') return String(actualValue).toLowerCase().includes(String(value).toLowerCase());

    return !!actualValue;
  }

  private static normalizeNodeType(rawType: string): string {
    const t = String(rawType || '').toLowerCase();
    if (t.includes('trigger')) return 'triggerNode';
    if (t.includes('logic') || t.includes('condition')) return 'logicNode';
    if (t.includes('message') || t.includes('text')) return 'messageNode';
    if (t.includes('template')) return 'templateNode';
    if (t.includes('tag')) return 'add_tag';
    if (t.includes('assign')) return 'assign_conversation';
    if (t.includes('deal')) return 'create_deal';
    return rawType;
  }
}
