/**
 * WORKFLOW SERVICE (Drip Engine)
 * 
 * Implements graph-traversal execution for visual workflows.
 * Port of legacy workflowExecutionService.js
 */

import { AutomationRule, IAutomationRule } from "@/lib/models/automation/AutomationRule";
import { WorkflowExecution } from "@/lib/models/automation/WorkflowExecution";
import { Contact } from "@/lib/models/messaging/Contact";
import { WabaService } from "../messaging/waba-service";
import { DealService } from "../commerce/deal-service";
import { Types } from "mongoose";
import crypto from 'crypto';

export class WorkflowService {
  /**
   * Trigger workflows based on an event
   */
  static async trigger(workspaceId: string | Types.ObjectId, event: string, data: any): Promise<void> {
    const rules = await AutomationRule.find({
      workspace: workspaceId,
      enabled: true,
      category: 'workflow',
      'trigger.event': event
    }).lean();

    for (const rule of rules) {
      await this.startExecution(rule as IAutomationRule, data);
    }
  }

  /**
   * Initialize a workflow execution
   */
  static async startExecution(rule: IAutomationRule, eventData: any): Promise<void> {
    const contactId = eventData.contactId || eventData.contact?._id;
    if (!contactId) return;

    // 1. Idempotency Check
    const idempotencyKey = this.generateKey(rule._id.toString(), eventData);
    const existing = await WorkflowExecution.findOne({ idempotencyKey });
    if (existing) return;

    // 2. Create Execution Record
    const execution = (await WorkflowExecution.create({
      workspace: rule.workspace,
      workflow: rule._id,
      triggerEvent: {
        type: 'message_received', // Default for now, can be improved
        contactId: contactId
      },
      status: 'running',
      idempotencyKey,
      startedAt: new Date()
    })) as any;

    // 3. Execute Flow (Graph Traversal)
    try {
      await this.traverse(rule, execution, eventData);
      execution.status = 'completed';
      execution.completedAt = new Date();
    } catch (err: any) {
      execution.status = 'failed';
      execution.error = err.message;
    }
    await execution.save();
  }

  /**
   * Graph Traversal Engine
   */
  private static async traverse(rule: IAutomationRule, execution: any, eventData: any): Promise<void> {
    const { nodes, edges } = rule.flowConfig;
    if (!nodes || nodes.length === 0) return;

    let currentNode = nodes.find(n => n.type === 'trigger');
    const visited = new Set<string>();

    while (currentNode) {
      if (visited.has(currentNode.id)) break; // Loop protection
      visited.add(currentNode.id);

      // Execute Action
      if (currentNode.type !== 'trigger') {
        await this.executeNode(currentNode, eventData, rule.workspace);
        execution.actionsExecuted.push({
            nodeId: currentNode.id,
            nodeType: currentNode.type,
            executedAt: new Date()
        });
      }

      // Find Next Node
      const outgoing = edges.filter(e => e.source === currentNode.id);
      if (outgoing.length === 0) break;

      let nextId = null;
      if (currentNode.type === 'condition') {
        const matches = this.evaluateCondition(currentNode, eventData);
        const edge = outgoing.find(e => e.sourceHandle === (matches ? 'true' : 'false'));
        nextId = edge?.target;
      } else {
        nextId = outgoing[0].target;
      }

      currentNode = nodes.find(n => n.id === nextId);
    }
  }

  /**
   * Node Executor
   */
  private static async executeNode(node: any, eventData: any, workspaceId: Types.ObjectId): Promise<any> {
    const contactId = eventData.contactId || eventData.contact?._id;
    const contact = await Contact.findById(contactId);
    if (!contact) return;

    const config = node.data?.config || {};

    switch (node.type) {
      case 'send_template':
        return await WabaService.sendTemplateMessage(
          workspaceId,
          contact.phone,
          config.templateName,
          'en',
          [],
          { contactId, metadata: { workflowId: node.id } }
        );

      case 'add_tag':
        if (!contact.tags.includes(config.tag)) {
          contact.tags.push(config.tag);
          await contact.save();
        }
        return;

      case 'delay':
        const ms = (config.delayMinutes || 1) * 60000;
        await new Promise(r => setTimeout(r, ms)); // Note: Real drips should use BullMQ for long delays
        return;

      case 'create_deal':
        return await DealService.createDeal(workspaceId, {
            contactId,
            pipelineId: config.pipelineId,
            title: config.title || `Workflow Deal: ${contact.name || contact.phone}`,
            value: config.value,
            stage: config.stageId,
            source: 'workflow'
        });

      case 'move_deal':
        if (contact.activeDealId) {
            return await DealService.moveStage(
                workspaceId.toString(),
                contact.activeDealId.toString(),
                config.stageId
            );
        }
        return;

      default:
        console.warn(`[Workflow] Unhandled node type: ${node.type}`);
    }
  }

  private static evaluateCondition(node: any, data: any): boolean {
    const { field, operator, value } = node.data || {};
    const actualRaw = data[field] || data.payload?.[field];
    const actual = String(actualRaw || '').toLowerCase();
    const val = String(value || '').toLowerCase();

    switch (operator) {
      case 'equals': return actual === val;
      case 'contains': return actual.includes(val);
      case 'is_not_empty': return !!actualRaw;
      default: return false;
    }
  }

  private static generateKey(ruleId: string, data: any): string {
    const seed = `${ruleId}:${data.messageId || data.id || Date.now()}`;
    return crypto.createHash('sha256').update(seed).digest('hex');
  }
}
