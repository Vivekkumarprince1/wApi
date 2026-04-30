import { sendInternalAction } from '../../lib/internal-client';

export const WabaService = {
  sendTextMessage: (workspaceId: string, phone: string, text: string, options?: any) => 
    sendInternalAction('SEND_TEXT', { workspaceId, phone, text, options }),
  sendTemplateMessage: (workspaceId: string, phone: string, templateName: string, languageCode: string, components: any[]) => 
    sendInternalAction('SEND_TEMPLATE', { workspaceId, phone, templateName, languageCode, components }),
  sendInteractiveMessage: (workspaceId: string, phone: string, interactive: any, options?: any) => 
    sendInternalAction('SEND_INTERACTIVE', { workspaceId, phone, interactive, options }),
  sendFlowMessage: (workspaceId: string, phone: string, flow: any, options?: any) => 
    sendInternalAction('SEND_FLOW', { workspaceId, phone, flow, options })
};

export const DealService = {
  createDeal: (workspaceId: string, data: any) => 
    sendInternalAction('CREATE_DEAL', { workspaceId, data }),
  moveStage: (workspaceId: string, dealId: string, stageId: string) =>
    sendInternalAction('MOVE_DEAL_STAGE', { workspaceId, dealId, stageId })
};

export const WhatsAppFormService = {
  recordSubmission: (workspaceId: string, contactId: string, flowToken: string, data: any, metadata?: any, options?: any) => 
    sendInternalAction('RECORD_FORM_SUBMISSION', { workspaceId, contactId, flowToken, data, metadata, options })
};

export const CheckoutBotService = {
  processMessage: (workspaceId: string, contactId: string, conversationId: string, body: string) => 
    sendInternalAction('CHECKOUT_BOT_PROCESS', { workspaceId, contactId, conversationId, body })
};

export const ContactService = {
  updateContact: (workspaceId: string, contactId: string, data: any) =>
    sendInternalAction('UPDATE_CONTACT', { workspaceId, contactId, data }),
  addTag: (workspaceId: string, contactId: string, tag: string) =>
    sendInternalAction('ADD_CONTACT_TAG', { workspaceId, contactId, tag })
};
