import { AutomationRule, IAutomationRule } from "../models";
import { WorkflowExecution } from "../models";
import { chatInternalClient } from "../lib/internal-client";
import { Types } from "mongoose";
import crypto from 'crypto';

/**
 * WORKFLOW SERVICE (Stateless Microservice Version)
 * Implements graph-traversal execution for visual workflows.
 */
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

  static async startExecution(rule: IAutomationRule, eventData: any): Promise<void> {
    const contactId = eventData.contactId || eventData.contact?._id;
    if (!contactId) return;

    const idempotencyKey = this.generateKey(rule._id.toString(), eventData);
    const existing = await WorkflowExecution.findOne({ idempotencyKey });
    if (existing) return;

    const execution = (await WorkflowExecution.create({
      workspace: rule.workspace,
      workflow: rule._id,
      triggerEvent: {
        type: eventData.type || 'message_received',
        contactId: contactId
      },
      status: 'running',
      idempotencyKey,
      startedAt: new Date(),
      actionsExecuted: []
    })) as any;

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

  private static async traverse(rule: IAutomationRule, execution: any, eventData: any): Promise<void> {
    const { nodes, edges } = rule.flowConfig || { nodes: [], edges: [] };
    if (!nodes || nodes.length === 0) return;

    let currentNode = nodes.find(n => n.type === 'trigger');
    const visited = new Set<string>();

    while (currentNode) {
      if (visited.has(currentNode.id)) break;
      visited.add(currentNode.id);

      if (currentNode.type !== 'trigger') {
        await this.executeNode(currentNode, eventData, rule.workspace.toString());
        execution.actionsExecuted.push({
            nodeId: currentNode.id,
            nodeType: currentNode.type,
            executedAt: new Date()
        });
      }

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

  private static async executeNode(node: any, eventData: any, workspaceId: string): Promise<any> {
    const contactId = eventData.contactId || eventData.contact?._id;
    const phone = eventData.phone || eventData.contact?.phone;
    
    const config = node.data?.config || {};

    // Relay all side-effects to Monolith Bridge
    try {
      await chatInternalClient.post('/api/internal/actions', {
        type: node.type,
        payload: {
          workspaceId,
          contactId,
          phone,
          config
        }
      });
    } catch (err: any) {
      console.error(`[Workflow] Node ${node.id} relay failed:`, err.message);
      throw err;
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
