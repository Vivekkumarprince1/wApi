import { Contact, WhatsAppForm, WhatsAppFormResponse } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * WhatsApp Form (Native Flows) Service
 * Resolves the massive gap in the legacy system where form submissions 
 * (nfm_reply) were never parsed or stored upon return.
 * 
 * NEW: Now links form submissions directly to AutomationRules for proper flow tracking.
 */
export class WhatsAppFormService {
  /**
   * Save an incoming form submission from a user
   * @param workspaceId - Workspace ID
   * @param contactId - Contact ID who submitted the form
   * @param flowToken - Identifies the specific flow session
   * @param responseJson - The form response data
   * @param automationRuleId - Optional: The AutomationRule ID that sent this form
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
      await dbConnect();
      
      console.log(`[WhatsAppFormService] Recording submission for flowToken ${flowToken}${automationRuleId ? ` from rule ${automationRuleId}` : ''}`);
      
      const contact = await Contact.findById(contactId).select("name phone").lean();
      if (!contact?.phone) {
        console.warn("[WhatsAppFormService] Contact missing phone; cannot persist form response");
        return null;
      }

      const possibleFlowId = responseJson?.flow_id || responseJson?.flowId || responseJson?.flow_token;
      const form = await WhatsAppForm.findOne({
        workspace: workspaceId,
        deletedAt: null,
        $or: [
          { flowId: possibleFlowId },
          { flowId: flowToken }
        ]
      }).select("_id").lean();

      if (!form?._id) {
        console.warn(`[WhatsAppFormService] No WhatsAppForm found for flow token ${flowToken}`);
        return null;
      }

      const responses = new Map<string, any>();
      Object.entries(responseJson || {}).forEach(([key, value]) => {
        if (key !== "flow_token") {
          responses.set(key, value);
        }
      });

      const now = new Date();
      const totalSteps = Array.isArray(responseJson?.screens) ? responseJson.screens.length : undefined;

      const record = await WhatsAppFormResponse.create({
        workspace: workspaceId,
        form: form._id,
        automationRule: automationRuleId,
        contact: contactId,
        userPhone: contact.phone,
        userName: contact.name,
        responses,
        status: "completed",
        currentStep: 0,
        totalSteps,
        completedSteps: 1,
        startedAt: now,
        completedAt: now,
        lastActivityAt: now,
        flowToken,
        rawFlowPayload: responseJson,
        messageIds: metadata?.messageId ? [metadata.messageId] : [],
        conversationId: metadata?.conversationId,
        sourceType: "whatsapp"
      });

      const formDoc = await WhatsAppForm.findById(form._id);
      if (formDoc) {
        const previousTotal = formDoc.statistics?.totalResponses || 0;
        const previousCompleted = formDoc.statistics?.completedResponses || 0;
        const previousAvg = formDoc.statistics?.averageTimeSpent || 0;
        const sessionTimeSeconds = Math.max(
          0,
          Math.round((now.getTime() - new Date(record.startedAt).getTime()) / 1000)
        );

        const nextTotal = previousTotal + 1;
        const nextCompleted = previousCompleted + 1;
        const nextAvg =
          previousTotal > 0
            ? ((previousAvg * previousTotal) + sessionTimeSeconds) / nextTotal
            : sessionTimeSeconds;

        formDoc.statistics = {
          totalResponses: nextTotal,
          completedResponses: nextCompleted,
          abandonedResponses: formDoc.statistics?.abandonedResponses || 0,
          totalStarts: Math.max(formDoc.statistics?.totalStarts || 0, nextTotal),
          completionRate: nextTotal > 0 ? Math.round((nextCompleted / nextTotal) * 100) : 0,
          lastResponseAt: now,
          averageTimeSpent: Number(nextAvg.toFixed(2)),
        };

        await formDoc.save();

        if (Array.isArray(formDoc.dataMapping) && formDoc.dataMapping.length > 0) {
          const contactDoc = await Contact.findById(contactId);
          if (contactDoc) {
            if (!contactDoc.customFields) {
              contactDoc.customFields = new Map<string, any>();
            }

            for (const mapping of formDoc.dataMapping) {
              const flowFieldId = String(mapping?.flowFieldId || '').trim();
              const crmField = String(mapping?.crmField || '').trim();
              if (!flowFieldId || !crmField) continue;

              const mappedValue = responses.get(flowFieldId);
              if (mappedValue === undefined || mappedValue === null || mappedValue === '') continue;

              if (crmField === 'name') {
                contactDoc.name = String(mappedValue);
              } else if (crmField === 'email') {
                contactDoc.metadata = {
                  ...(contactDoc.metadata || {}),
                  email: String(mappedValue),
                };
              } else {
                contactDoc.customFields.set(crmField, mappedValue);
              }
            }

            await contactDoc.save();
          }
        }

        if (formDoc.webhookConfig?.enabled && formDoc.webhookConfig?.url) {
          try {
            await fetch(formDoc.webhookConfig.url, {
              method: formDoc.webhookConfig.method || 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(formDoc.webhookConfig.headers || {}),
              },
              body: JSON.stringify({
                event: 'whatsapp_form_submitted',
                workspaceId,
                formId: String(formDoc._id),
                formName: formDoc.name,
                contactId,
                flowToken,
                conversationId: metadata?.conversationId,
                messageId: metadata?.messageId,
                responses: Object.fromEntries(responses.entries()),
                submittedAt: now.toISOString(),
              }),
            });
          } catch (webhookError: any) {
            console.warn('[WhatsAppFormService] Webhook delivery failed:', webhookError?.message || 'unknown error');
          }
        }
      }

      console.log(`[WhatsAppFormService] Form submission saved: ${record._id}`);
      return record;
    } catch (error: any) {
      console.error('[WhatsAppFormService] Failed to record form submission:', error.message);
      return null;
    }
  }
}
