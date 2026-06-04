import { chatInternalClient } from "../lib/internal-client";

/**
 * SIMPLE ACTION EXECUTOR
 * Handles one-off actions for Rules (not Workflows).
 * Relays all execution to the Monolith Bridge.
 */
export class SimpleActionExecutor {
  static async execute(rule: any, context: any) {
    const actions = rule.actions || [];
    const workspaceId = rule.workspace?.toString();

    for (const action of actions) {
      try {
        console.info(`[SimpleAction] Relaying ${action.type} for rule ${rule._id}`);
        
        await chatInternalClient.post('/api/internal/actions', {
          type: action.type,
          payload: {
            workspaceId,
            contactId: context.contactId,
            conversationId: context.conversationId,
            phone: context.contact?.phone,
            config: action.config || {}
          }
        });
      } catch (err: any) {
        console.error(`[SimpleAction] Failed to execute ${action.type}:`, err.message);
        if (!action.continueOnFailure) break;
      }
    }
  }
}
