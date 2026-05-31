import type { ObjectIdString } from './common';
/**
 * Automation actions emitted by `automation-service` and dispatched by
 * the monolith at `POST /api/internal/actions`. Names are lowercase
 * snake_case and must match the switch in
 * `server/src/controllers/internalController.ts`.
 */
export type AutomationActionType = 'send_text' | 'send_message' | 'send_template' | 'send_interactive' | 'send_flow' | 'create_deal' | 'move_deal_stage' | 'add_tag' | 'add_contact_tag' | 'update_contact' | 'bot_escalation' | 'update_metadata' | 'checkout_bot_process' | 'record_form_submission';
export interface AutomationActionPayloadBase {
    workspaceId: ObjectIdString;
    contactId?: ObjectIdString;
    conversationId?: ObjectIdString;
}
export interface AutomationActionEnvelope {
    type: AutomationActionType;
    payload: AutomationActionPayloadBase & Record<string, unknown>;
}
//# sourceMappingURL=automation-actions.d.ts.map