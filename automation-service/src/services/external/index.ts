import { sendInternalAction } from '../../lib/internal-client';

/**
 * Action types are sent to the monolith's `/api/internal/actions` endpoint
 * and dispatched by `internalController.executeAction`. Names are canonical
 * lowercase snake_case to match the monolith switch.
 */

export const WabaService = {
  sendTextMessage: (workspaceId: string, phone: string, text: string, options?: any) =>
    sendInternalAction('send_text', { workspaceId, phone, text, options }),
  sendTemplateMessage: (workspaceId: string, phone: string, templateName: string, languageCode: string, components: any[]) =>
    sendInternalAction('send_template', { workspaceId, phone, templateName, languageCode, components }),
  sendInteractiveMessage: (workspaceId: string, phone: string, interactive: any, options?: any) =>
    sendInternalAction('send_interactive', { workspaceId, phone, interactive, options }),
  sendFlowMessage: (workspaceId: string, phone: string, flow: any, options?: any) =>
    sendInternalAction('send_flow', { workspaceId, phone, flow, options })
};

export const DealService = {
  createDeal: (workspaceId: string, data: any) =>
    sendInternalAction('create_deal', { workspaceId, data }),
  moveStage: (workspaceId: string, dealId: string, stageId: string) =>
    sendInternalAction('move_deal_stage', { workspaceId, dealId, stageId })
};

export const WhatsAppFormService = {
  recordSubmission: (workspaceId: string, contactId: string, flowToken: string, data: any, metadata?: any, options?: any) =>
    sendInternalAction('record_form_submission', { workspaceId, contactId, flowToken, data, metadata, options })
};

export const CheckoutBotService = {
  processMessage: (workspaceId: string, contactId: string, conversationId: string, body: string) =>
    sendInternalAction('checkout_bot_process', { workspaceId, contactId, conversationId, body })
};

export const ContactService = {
  updateContact: (workspaceId: string, contactId: string, data: any) =>
    sendInternalAction('update_contact', { workspaceId, contactId, data }),
  addTag: (workspaceId: string, contactId: string, tag: string) =>
    sendInternalAction('add_contact_tag', { workspaceId, contactId, tag })
};
