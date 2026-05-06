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

export const internalController = {
  /**
   * WORKER BRIDGE (Used by Campaign Service)
   */
  async workerBridge(req: Request, res: Response) {
    try {
      const { action, data } = req.body;

      switch (action) {
        case 'send-template':
          const result = await WabaService.sendTemplateMessage(
            data.workspaceId,
            data.to,
            data.templateName,
            data.languageCode,
            data.components,
            data.options
          );
          return res.json(result);

        case 'preflight-validate':
          const preflight = await PreflightPolicyService.validate(data.workspaceId, data.templateId, data.contactsCount);
          return res.json(preflight);

        case 'socket-broadcast':
          SocketService.emitCustom(data.workspaceId, data.event, data.payload);
          return res.json({ success: true });

        case 'get-pricing':
          const response = await axios.get(`${appConfig.billingServiceUrl}/api/billing/wallets/${data.workspaceId}/pricing`, {
            headers: {
              'x-internal-service-secret': appConfig.internalServiceSecret,
              'x-workspace-id': data.workspaceId,
            },
            params: { category: data.category }
          });
          return res.json({ cost: response.data.cost });

        case 'get-template':
          const template = await Template.findById(data.templateId).lean();
          return res.json({ template });

        case 'get-contact':
          const contact = await Contact.findById(data.contactId).lean();
          return res.json({ contact });

        case 'query-contacts':
          const contacts = await Contact.find(data.query).distinct('_id');
          return res.json({ contacts });
          
        case 'count-contacts':
          const count = await Contact.countDocuments(data.query);
          return res.json({ count });

        case 'billing-park':
          await axios.post(`${appConfig.billingServiceUrl}/api/billing/wallets/${data.workspaceId}/reserve`, {
            amount: data.amount,
            campaignId: data.campaignId
          }, {
            headers: { 'x-internal-service-secret': appConfig.internalServiceSecret }
          });
          return res.json({ success: true });

        case 'billing-settle':
          await axios.post(`${appConfig.billingServiceUrl}/api/billing/wallets/${data.workspaceId}/settle`, {
            campaignId: data.campaignId,
            reservedAmount: data.reservedAmount,
            actualSpend: data.actualSpend
          }, {
            headers: { 'x-internal-service-secret': appConfig.internalServiceSecret }
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
   */
  async executeAction(req: Request, res: Response) {
    try {
      const { type, payload } = req.body;
      const { workspaceId, contactId, config } = payload;

      console.log(`[InternalAction] Executing ${type} for workspace ${workspaceId}`);

      switch (type) {
        case 'send_message':
          await WabaService.sendTextMessage(workspaceId, payload.phone, config.body, {
            contactId,
            conversationId: payload.conversationId
          });
          break;

        case 'send_template':
          await WabaService.sendTemplateMessage(
            workspaceId,
            payload.phone,
            config.templateName,
            config.languageCode || 'en_US',
            config.components || []
          );
          break;

        case 'create_deal':
          await DealService.createDeal(workspaceId, {
            contactId,
            title: config.title || 'New Deal from Automation',
            value: config.value || 0,
            stageId: config.stageId
          });
          break;

        case 'add_tag':
          await ContactService.addTag(workspaceId, contactId, config.tagId);
          break;

        case 'bot_escalation':
          if (payload.conversationId) {
            await Conversation.findByIdAndUpdate(payload.conversationId, {
              'botMetadata.isBotPaused': true,
              'botMetadata.lastBotInteractionAt': new Date()
            });
          }
          break;

        case 'update_metadata':
          if (payload.conversationId) {
            await Conversation.findByIdAndUpdate(payload.conversationId, {
              botMetadata: payload.metadata
            });
          }
          break;

        default:
          console.warn(`[InternalAction] Unknown action type: ${type}`);
          return res.status(400).json({ success: false, error: 'Unknown action type' });
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
