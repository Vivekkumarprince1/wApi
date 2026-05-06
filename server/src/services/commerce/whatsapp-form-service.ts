import { Contact } from "@/models";
import { proxyController } from "@/controllers/proxyController";

/**
 * WhatsApp Form (Native Flows) Service
 * Resolves the massive gap in the legacy system where form submissions 
 * (nfm_reply) were never parsed or stored upon return.
 * 
 * NEW: Now proxies form submissions directly to Automation Microservice.
 */
export class WhatsAppFormService {
  /**
   * Save an incoming form submission from a user via Automation Service
   */
  static async recordSubmission(
    workspaceId: string, 
    contactId: string, 
    flowToken: string,
    responseJson: any,
    automationRuleId?: string,
    metadata?: { conversationId?: string; messageId?: string }
  ) {
    try {
      console.log(`[WhatsAppFormService] Proxying submission for flowToken ${flowToken}`);
      
      const response = await proxyController.forwardToService('automation', {
        method: 'POST',
        path: '/api/automation/engine/whatsapp-forms/submissions',
        data: {
          workspaceId,
          contactId,
          flowToken,
          responseJson,
          automationRuleId,
          metadata
        },
        workspaceId,
        correlationId: `flow_${flowToken}`
      });

      return response.data;
    } catch (error: any) {
      console.error('[WhatsAppFormService] Failed to proxy form submission:', error.message);
      return null;
    }
  }
}
