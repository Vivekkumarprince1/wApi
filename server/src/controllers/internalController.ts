import { Request, Response } from 'express';
import { WabaService } from '../services/messaging/waba-service';
import { PreflightPolicyService } from '../services/marketing/preflight-policy';
import * as SocketService from '../services/socket-service';
import { Contact, Template, Conversation, Integration } from '../models';
import { DealService } from '../services/commerce/deal-service';
import { ContactService } from '../services/messaging/contact-service';
import { CheckoutBotService } from '../services/commerce/checkout-bot-service';
import axios from 'axios';
import { config as appConfig } from '../config';
import { getCorrelationId } from '../utils/logger';

function correlationHeaders(): { 'x-correlation-id': string } {
  const id =
    getCorrelationId() ||
    `corr_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return { 'x-correlation-id': id };
}

export const internalController = {
  /**
   * WORKER BRIDGE (Used by Campaign Service)
   */
  async workerBridge(req: Request, res: Response) {
    try {
      const { action, data } = req.body;

      // Every worker-bridge call MUST scope to a workspace. Without this
      // an internal caller can read or query data across tenants.
      if (!data || !data.workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required for worker-bridge calls' });
      }
      const workspaceId = String(data.workspaceId);

      switch (action) {
        case 'send-template':
          const result = await WabaService.sendTemplateMessage(
            workspaceId,
            data.to,
            data.templateName,
            data.languageCode,
            data.components,
            data.options
          );
          return res.json(result);

        case 'preflight-validate':
          const preflight = await PreflightPolicyService.validate(workspaceId, data.templateId, data.contactsCount);
          return res.json(preflight);

        case 'socket-broadcast':
          SocketService.emitCustom(workspaceId, data.event, data.payload);
          return res.json({ success: true });

        case 'get-pricing':
          const response = await axios.get(`${appConfig.billingServiceUrl}/api/billing/wallets/${workspaceId}/pricing`, {
            headers: {
              'x-internal-service-secret': appConfig.internalServiceSecret,
              'x-workspace-id': workspaceId,
              ...correlationHeaders(),
            },
            params: { category: data.category }
          });
          // Forward the full billing response so callers can use
          // success/category, not just cost.
          return res.json({
            success: response.data?.success ?? true,
            cost: response.data?.cost,
            category: response.data?.category,
          });

        case 'get-template': {
          const template = await Template.findOne({
            _id: data.templateId,
            workspace: workspaceId,
          }).lean();
          return res.json({ template });
        }

        case 'get-contact': {
          const contact = await Contact.findOne({
            _id: data.contactId,
            workspace: workspaceId,
          }).lean();
          return res.json({ contact });
        }

        case 'query-contacts': {
          // Always scope to the calling workspace, even if `data.query`
          // tries to widen the filter.
          const safeQuery = { ...(data.query || {}), workspace: workspaceId };
          const contacts = await Contact.find(safeQuery).distinct('_id');
          return res.json({ contacts });
        }

        case 'count-contacts': {
          const safeQuery = { ...(data.query || {}), workspace: workspaceId };
          const count = await Contact.countDocuments(safeQuery);
          return res.json({ count });
        }

        case 'list-orders': {
          const response = await axios.get(
            `${appConfig.billingServiceUrl}/api/billing/commerce/wallets/${workspaceId}/orders`,
            {
              headers: {
                'x-internal-service-secret': appConfig.internalServiceSecret,
                'x-workspace-id': workspaceId,
                ...correlationHeaders(),
              },
              params: data.params || data.query || {},
            }
          );
          return res.status(response.status).json(response.data);
        }

        case 'billing-park':
          await axios.post(`${appConfig.billingServiceUrl}/api/billing/wallets/${workspaceId}/reserve`, {
            amount: data.amount,
            campaignId: data.campaignId
          }, {
            headers: { 'x-internal-service-secret': appConfig.internalServiceSecret, ...correlationHeaders() }
          });
          return res.json({ success: true });

        case 'billing-settle':
          await axios.post(`${appConfig.billingServiceUrl}/api/billing/wallets/${workspaceId}/settle`, {
            campaignId: data.campaignId,
            reservedAmount: data.reservedAmount,
            actualSpend: data.actualSpend
          }, {
            headers: { 'x-internal-service-secret': appConfig.internalServiceSecret, ...correlationHeaders() }
          });
          return res.json({ success: true });

        default:
          return res.status(400).json({ error: "Invalid action" });
      }
    } catch (error: any) {
      console.error("[WorkerBridge] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * ACTIONS ENDPOINT (Used by Automation Service)
   *
   * Action names are lowercase snake_case and MUST match what the
   * automation-service emits in `automation-service/src/services/external/index.ts`.
   * Both shapes are accepted:
   *   - flat payload: { workspaceId, phone, text, ... }    ← automation-service
   *   - nested config payload: { workspaceId, contactId, config: { body, ... } } ← legacy callers
   */
  async executeAction(req: Request, res: Response) {
    try {
      const { type, payload } = req.body || {};
      if (!payload || !payload.workspaceId) {
        return res.status(400).json({ success: false, error: 'payload.workspaceId is required' });
      }
      const { workspaceId, contactId } = payload;
      const config = payload.config || {};
      const action = String(type || '').toLowerCase();

      console.log(`[InternalAction] Executing ${action} for workspace ${workspaceId}`);

      switch (action) {
        // ── messaging ─────────────────────────────────────────────────────
        case 'send_text':
        case 'send_message': {
          const text = payload.text ?? config.body;
          await WabaService.sendTextMessage(workspaceId, payload.phone, text, {
            contactId,
            conversationId: payload.conversationId,
            ...(payload.options || {}),
          });
          break;
        }

        case 'send_template':
          await WabaService.sendTemplateMessage(
            workspaceId,
            payload.phone,
            payload.templateName ?? config.templateName,
            payload.languageCode ?? config.languageCode ?? 'en_US',
            payload.components ?? config.components ?? []
          );
          break;

        case 'send_interactive':
          await WabaService.sendInteractiveMessage(
            workspaceId,
            payload.phone,
            payload.interactive ?? config.interactive,
            { contactId, conversationId: payload.conversationId, ...(payload.options || {}) }
          );
          break;

        case 'send_flow':
          await WabaService.sendFlowMessage(
            workspaceId,
            payload.phone,
            payload.flow ?? config.flow,
            { contactId, conversationId: payload.conversationId, ...(payload.options || {}) }
          );
          break;

        // ── crm ──────────────────────────────────────────────────────────
        case 'create_deal': {
          const dealData = payload.data || {
            contactId,
            title: config.title || 'New Deal from Automation',
            value: config.value || 0,
            stageId: config.stageId,
          };
          await DealService.createDeal(workspaceId, dealData);
          break;
        }

        case 'move_deal_stage':
          await DealService.moveStage(workspaceId, payload.dealId, payload.stageId);
          break;

        case 'add_tag':
        case 'add_contact_tag': {
          const tagId = payload.tag ?? payload.tagId ?? config.tagId;
          await ContactService.addTag(workspaceId, contactId ?? payload.contactId, tagId);
          break;
        }

        case 'update_contact': {
          const ContactModel = (await import('../models')).Contact;
          await ContactModel.updateOne(
            { _id: payload.contactId, workspace: workspaceId },
            { $set: payload.data || {} }
          );
          break;
        }

        // ── conversation / bot ───────────────────────────────────────────
        case 'bot_escalation':
          if (payload.conversationId) {
            await Conversation.updateOne(
              { _id: payload.conversationId, workspace: workspaceId },
              {
                'botMetadata.isBotPaused': true,
                'botMetadata.lastBotInteractionAt': new Date(),
              }
            );
          }
          break;

        case 'update_metadata':
          if (payload.conversationId) {
            await Conversation.updateOne(
              { _id: payload.conversationId, workspace: workspaceId },
              { $set: { botMetadata: payload.metadata } }
            );
          }
          break;

        case 'checkout_bot_process': {
          await CheckoutBotService.processMessage(
            workspaceId,
            payload.contactId,
            payload.conversationId,
            payload.body
          );
          break;
        }

        case 'record_form_submission': {
          if (!payload.flowToken) {
            return res.status(400).json({ success: false, error: 'flowToken is required' });
          }
          const { FormSubmission } = await import('../models');
          await FormSubmission.findOneAndUpdate(
            { workspace: workspaceId, flowToken: payload.flowToken },
            {
              $set: {
                workspace: workspaceId,
                contact: payload.contactId || undefined,
                conversation: payload.conversationId || undefined,
                flowToken: payload.flowToken,
                flowId: payload.flowId,
                data: payload.data || {},
                metadata: payload.metadata,
                options: payload.options,
                receivedAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
          break;
        }

        default:
          console.warn(`[InternalAction] Unknown action type: ${type}`);
          return res.status(400).json({ success: false, error: 'Unknown action type', type });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[InternalAction] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * CONVERSATION METADATA (Used by Automation Service)
   */
  async updateConversationMetadata(req: Request, res: Response) {
    try {
        const { conversationId, metadata } = req.body;
        await Conversation.findByIdAndUpdate(conversationId, {
            $set: { botMetadata: metadata }
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * CHECKOUT BOT PROCESS (Used by Automation Service)
   */
  async processCheckout(req: Request, res: Response) {
    try {
      const { workspaceId, contactId, conversationId, messageBody } = req.body;
      const result = await CheckoutBotService.processMessage(
        workspaceId,
        contactId,
        conversationId,
        messageBody
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("[InternalCheckout] Error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
