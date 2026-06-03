import { Types } from 'mongoose';
import { Workspace } from '../../models/workspace/Workspace';
import { Message, IMessageDocument, MessageStatus, MessageType } from '../../models/messaging/Message';
import { Conversation } from '../../models/messaging/Conversation';
import { Contact } from '../../models/messaging/Contact';
import { Template } from '../../models/template/Template';
import { GupshupService } from './gupshup-service';
import { GupshupPartnerService } from '../bsp/gupshup-partner-service';
import { LedgerService } from '../billing/ledger-service';
import { ConversationService } from './conversation-service';
import { connectRedis } from '../../redis';
import { proxyController } from '../../controllers/proxyController';

/**
 * WABA Messaging Service
 * 
 * Mid-level service that handles multi-tenancy, session window enforcement,
 * and database logging for all WhatsApp messages.
 */

export interface ISendMessageOptions {
  contactId?: Types.ObjectId | string;
  conversationId?: Types.ObjectId | string;
  sentBy?: Types.ObjectId | string;
  campaignId?: Types.ObjectId | string;
  metadata?: any;
  socketId?: string;
}

export class WabaService {
  private static renderTemplateBody(templateBody: string, components: any[] = []): string {
    if (!templateBody) return '';
    const bodyComp = Array.isArray(components)
      ? components.find((c: any) => String(c?.type || '').toUpperCase() === 'BODY')
      : undefined;
    const params = Array.isArray(bodyComp?.parameters) ? bodyComp.parameters : [];

    return templateBody.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, idx) => {
      const i = Math.max(parseInt(String(idx), 10) - 1, 0);
      const value = params[i]?.text ?? params[i]?.value;
      return value == null ? '' : String(value);
    });
  }

  /**
   * Check if a text/media message can be sent (free-tier session window)
   */
  static async canSendSessionMessage(
    workspaceId: string | Types.ObjectId,
    phoneNumber: string,
    contactId?: Types.ObjectId | string
  ): Promise<boolean> {
    const from = GupshupService.normalizePhoneNumber(phoneNumber);
    
    // Find contact and conversation to check window
    const contact = contactId
      ? await Contact.findOne({ _id: contactId, workspace: workspaceId }).lean()
      : await Contact.findOne({ workspace: workspaceId, phone: from }).lean();
    if (!contact) return false;

    const conversation = await Conversation.findOne({ workspace: workspaceId, contact: contact._id })
      .sort({ lastActivityAt: -1 })
      .lean();
    if (!conversation) return false;

    const now = new Date();
    // Window is open if isOpen is true AND it hasn't expired
    const isOpen = conversation.isOpen && (!conversation.windowExpiresAt || new Date(conversation.windowExpiresAt) > now);
    if (isOpen) {
      return true;
    }

    // Self-heal stale conversation session metadata from the latest inbound message.
    const lastInboundMessage = await Message.findOne({
      workspace: workspaceId,
      contact: contact._id,
      direction: 'inbound'
    })
      .sort({ sentAt: -1, createdAt: -1 })
      .select('sentAt createdAt')
      .lean();

    if (!lastInboundMessage) {
      return false;
    }

    const lastInboundAt =
      (lastInboundMessage as any).sentAt ||
      (lastInboundMessage as any).createdAt;

    if (!lastInboundAt) {
      return false;
    }

    const lastInboundDate = new Date(lastInboundAt);
    if (Number.isNaN(lastInboundDate.getTime())) {
      return false;
    }

    const recoveredWindowExpiry = new Date(lastInboundDate.getTime() + 24 * 60 * 60 * 1000);
    if (recoveredWindowExpiry <= now) {
      return false;
    }

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          isOpen: true,
          windowExpiresAt: recoveredWindowExpiry,
          lastInboundAt: lastInboundDate,
          status: conversation.status === 'closed' ? 'open' : conversation.status,
          lastActivityAt: now
        }
      }
    );

    return true;
  }

  /**
   * Send a text message with full tenant orchestration
   */
  static async sendTextMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    text: string,
    options: ISendMessageOptions = {}
  ) {
    // 1. Resolve Workspace Info
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);

    const normalizedTo = GupshupService.normalizePhoneNumber(to);
    if (sourcePhone && normalizedTo === sourcePhone) {
      throw new Error('SELF_SEND_NOT_ALLOWED');
    }

    // 2. Validate session window for text messages
    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) {
      throw new Error('SESSION_EXPIRED'); // Upper layers (InboxService) should handle fallback to template
    }

    // 3. Dispatch to provider
    const result = await GupshupService.sendText(appId, undefined, to, text, sourcePhone);

    // 4. Log to database
    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'text',
      body: text,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      failureReason: result.error,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        providerEnvelopeId: result.providerEnvelopeId,
        gs_id: result.data?.gs_id || result.data?.gsId,
        providerResponse: result.data
      }
    });

    console.log(`[WabaService] Created outbound message ${message._id} with providerId: ${result.messageId} in workspace ${workspaceId}`);
    
    // 5. Sync to Conversation Hub (Ensures inbox visibility)
    await ConversationService.syncMessage(message._id, options.socketId);

    return { success: result.success, message, result };
  }

  /**
   * Send a template message with full tenant orchestration
   */
  static async sendTemplateMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components: any[] = [],
    options: ISendMessageOptions = {}
  ) {
    // 1. Resolve Workspace Info
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);

    const normalizedTo = GupshupService.normalizePhoneNumber(to);
    if (sourcePhone && normalizedTo === sourcePhone) {
      return { success: false, result: { error: 'SELF_SEND_NOT_ALLOWED' }, message: null };
    }

    // 2. Billing & Pricing Pre-flight
    const template = await Template.findOne({
      workspace: workspaceId,
      $or: [
        { name: templateName },
        { metaTemplateName: templateName }
      ]
    }).lean();

    if (!template) {
      return { success: false, result: { error: `TEMPLATE_NOT_FOUND: ${templateName}` }, message: null };
    }

    if (template.status !== 'APPROVED') {
      return { success: false, result: { error: `TEMPLATE_NOT_APPROVED: ${template.status}` }, message: null };
    }

    if (template.category === 'MARKETING' && options.contactId) {
      const contact = await Contact.findById(options.contactId).select('isColdContact').lean();
      if (contact?.isColdContact) {
        return {
          success: false,
          result: {
            error: 'MARKETING_COLD_CONTACT_BLOCKED: Marketing templates are often suppressed for contacts that have never messaged first.'
          },
          message: null
        };
      }
    }

    const providerTemplateName = (template as any).metaTemplateName || (template as any).name || templateName;
    const providerLanguageCode = languageCode || (template as any).language || 'en';

    let cost = 0;
    try {
      const pricingResponse = await proxyController.forwardToService('billing', {
        method: 'GET',
        path: `/api/billing/wallets/${workspaceId}/pricing`,
        params: { category: template?.category || 'MARKETING' },
        workspaceId: workspaceId.toString()
      });
      cost = pricingResponse.data.cost || 0;
    } catch (err) {
      console.warn('[WabaService] Failed to get pricing from billing service, defaulting to 0:', err);
      cost = 0;
    }

    let deducted = false;
    try {
      // Deduct from wallet if not part of a campaign (Campaigns are handled via parked balance settlement)
      if (cost > 0 && !options.campaignId) {
          let availableBalance = 0;
          try {
            const walletResponse = await proxyController.forwardToService('billing', {
              method: 'GET',
              path: `/api/billing/wallets/${workspaceId}`,
              workspaceId: workspaceId.toString()
            });
            availableBalance = walletResponse.data.wallet?.availableBalance || 0;
          } catch (err) {
            console.warn('[WabaService] Failed to get wallet from billing service, skipping deduction:', err);
            availableBalance = Number.MAX_SAFE_INTEGER; // Temporarily allow send if we can't check wallet
          }
          
          if (availableBalance < cost) {
              throw new Error('INSUFFICIENT_BALANCE');
          }

          await LedgerService.deduct(workspaceId, cost, {
            type: 'SPEND',
            description: `Sent ${providerTemplateName} template`,
            referenceType: 'messaging'
          });
          deducted = true;
      }

    // 3. Dispatch to Provider (Gupshup)
    const result = await GupshupService.sendTemplate(
      appId,
      undefined,
      to,
      providerTemplateName,
      providerLanguageCode,
      components,
      sourcePhone
    );

    if (!result.success) {
      // Refund if deduction happened but send failed
      if (deducted) {
          await LedgerService.credit(workspaceId, cost, {
            type: 'REFUND',
            description: `Refund: ${providerTemplateName} dispatch failed: ${result.error || 'Unknown Error'}`,
            referenceType: 'messaging'
          });
        }
        return { success: false, result, message: null };
      }

      const renderedBody = this.renderTemplateBody((template as any)?.body?.text || '', components);

      // 4. Log Message
      const message = await Message.create({
        workspace: workspaceId,
        contact: options.contactId,
        conversation: options.conversationId,
        direction: 'outbound',
        type: 'template',
        body: renderedBody || `[Template: ${providerTemplateName}]`,
        template: {
            id: (template as any)._id,
            name: providerTemplateName,
            metaTemplateName: (template as any).metaTemplateName || providerTemplateName,
            category: (template as any)?.category || 'MARKETING',
            language: providerLanguageCode,
            header: {
              format: (template as any)?.header?.format,
              text: (template as any)?.header?.text,
              mediaUrl: (template as any)?.header?.mediaUrl,
            },
            buttons: Array.isArray((template as any)?.buttons?.items)
              ? (template as any).buttons.items
              : undefined,
            variables: {
              header: Array.isArray((template as any)?.header?.variables) ? (template as any).header.variables : [],
              body: Array.isArray((template as any)?.body?.variables) ? (template as any).body.variables : [],
              buttons: [],
            },
            // not part of typed interface, but used by UI fallback paths
            footerText: (template as any)?.footer?.text,
        },
        status: result.success ? 'sent' : 'failed',
        whatsappMessageId: result.messageId,
        failureReason: result.error,
        sentBy: options.sentBy,
        campaign: options.campaignId ? { id: options.campaignId } : undefined,
        recipientPhone: GupshupService.normalizePhoneNumber(to),
        meta: {
          ...options.metadata,
            providerEnvelopeId: result.providerEnvelopeId,
          providerResponse: result.data
        }
      });

      console.log(`[WabaService] Created template message ${message._id} with providerId: ${result.messageId} in workspace ${workspaceId}`);

      // 5. Sync to Conversation Hub (Ensures inbox visibility)
      await ConversationService.syncMessage(message._id, options.socketId);

      return { success: result.success, message, result };
    } catch (err: any) {
      console.error('[WABA Service Error]:', err.message || err);
      // Final safety refund
      if (deducted && cost > 0) {
        try {
          await LedgerService.credit(workspaceId, cost, {
            type: 'REFUND',
            description: `Refund: Exception during ${providerTemplateName} dispatch: ${err.message}`,
            referenceType: 'messaging'
          });
        } catch (creditErr) {
          console.error('[CRITICAL] Failed to refund after exception:', creditErr);
        }
      }
      return { success: false, result: { error: err.message }, message: null };
    }
  }

  /**
   * Send a media message with session-window enforcement
   */
  static async sendMediaMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    type: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    mediaUrl: string,
    mimeType?: string,
    caption?: string,
    filename?: string,
    options: ISendMessageOptions = {}
  ) {
    // 1. Resolve Workspace Info
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);

    const normalizedTo = GupshupService.normalizePhoneNumber(to);
    if (sourcePhone && normalizedTo === sourcePhone) {
      throw new Error('SELF_SEND_NOT_ALLOWED');
    }

    // 2. Validate session window for media messages
    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) {
      throw new Error('SESSION_EXPIRED');
    }

    // 3. Dispatch to provider
    const result = await GupshupService.sendMedia(appId, undefined, to, type, mediaUrl, caption, filename, sourcePhone);
    if (!result.success) {
      return { success: false, result, message: null };
    }

    // 4. Log message
    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type,
      body: caption || `[${type}]`,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      failureReason: result.error,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      media: {
        url: mediaUrl,
        mimeType,
        filename,
        caption,
      },
      meta: {
        ...options.metadata,
        providerEnvelopeId: result.providerEnvelopeId,
        gs_id: result.data?.gs_id || result.data?.gsId,
        providerResponse: result.data
      }
    });

    // 5. Sync to Conversation Hub (Ensures inbox visibility)
    await ConversationService.syncMessage(message._id);

    return { success: true, message, result };
  }

  /**
   * Submit a DRAFT template to Meta for approval
   */
  static async submitTemplateForApproval(workspaceId: string | Types.ObjectId, templateId: string) {
    const { appId, appApiKey } = await (this as any).resolveWorkspaceConfig(workspaceId);
    if (!appApiKey) throw new Error('APP_TOKEN_MISSING');

    const template = await Template.findById(templateId);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');

    // 1. Map to Provider format
    const components = (Template as any).mapToGupshupComponents(template);
    
    const payload = {
      name: template.name,
      category: template.category,
      language: template.language,
      components
    };

    // 2. Dispatch to provider
    const result = await GupshupService.createTemplate(appId, appApiKey, payload);
    
    // 3. Update internal status
    template.status = 'PENDING';
    template.metaTemplateId = result.data?.id || result.id;
    template.submittedAt = new Date();
    await template.save();

    return result;
  }

  /**
   * Sync all templates from Gupshup to local database
   */
  static async syncTemplates(workspaceId: string | Types.ObjectId) {
    const { appId, appApiKey } = await (this as any).resolveWorkspaceConfig(workspaceId);
    // console.log(`[WabaService] Syncing templates for appId: ${appId} (Token present: ${!!appApiKey})`);
    
    if (!appApiKey) throw new Error('APP_TOKEN_MISSING');

    const result = await GupshupService.fetchTemplates(appId, appApiKey);
    const templates = Array.isArray(result) ? result : (result.templates || result.data || []);

    let synced = 0;
    let updated = 0;
    let created = 0;
    const syncedIds: string[] = [];

    for (const t of templates) {
      if (!t.elementName) continue;
      // console.log(`[WabaService:Sync] Template: ${t.elementName} | Raw Status: ${t.status}`);

      try {
        const mappedStatus = this.mapGupshupStatus(t.status);
        const mappedCategory: any = (Template as any).getValidMetaCategory?.(t.category) || 'MARKETING';

        // Parse structured data if available
        let header: any = { enabled: false, format: 'NONE' };
        let footer: any = { enabled: false };
        let buttons: any = { enabled: false, items: [] };
        
        const meta = typeof t.metaData === 'string' ? JSON.parse(t.metaData) : (t.metaData || {});
        
        if (meta.header) {
          header = {
            enabled: true,
            format: meta.header.type || 'TEXT',
            text: meta.header.text,
            mediaUrl: meta.header.example?.header_handle?.[0] || meta.header.example?.header_url?.[0]
          };
        }

        if (meta.footer) {
          footer = {
            enabled: true,
            text: meta.footer.text
          };
        }

        if (Array.isArray(meta.buttons) && meta.buttons.length > 0) {
          buttons = {
            enabled: true,
            items: meta.buttons.map((b: any) => ({
              type: b.type === 'PHONE' ? 'PHONE_NUMBER' : b.type,
              text: b.text,
              url: b.url,
              phoneNumber: b.phone_number
            }))
          };
        }

        const templateData = {
          workspace: workspaceId,
          name: t.elementName.toLowerCase(),
          language: t.languageCode || 'en',
          category: mappedCategory,
          status: mappedStatus,
          metaTemplateId: t.id,
          metaTemplateName: t.elementName,
          body: {
            text: t.data || t.content || '',
          },
          header,
          footer,
          buttons,
          source: 'BSP',
          lastSyncedAt: new Date()
        };

        const existing = await Template.findOne({
          workspace: workspaceId,
          name: templateData.name,
          language: templateData.language
        });

        if (existing) {
          await Template.updateOne({ _id: existing._id }, { $set: templateData });
          updated++;
          syncedIds.push(existing._id.toString());
        } else {
          const doc = await Template.create(templateData);
          created++;
          syncedIds.push(doc._id.toString());
        }
        synced++;
      } catch (err: any) {
        console.error(`[WabaService:Sync] Failed to process template ${t.elementName}:`, err.message);
      }
    }

    console.log(`[WabaService] Synced ${synced} templates for workspace ${workspaceId} (Created: ${created}, Updated: ${updated})`);

    // Pruning: Mark templates as DELETED if they were NOT in the sync batch
    // We only prune templates that came from BSP (to avoid deleting local-only drafts)
    const purgeResult = await Template.updateMany({
      workspace: workspaceId,
      _id: { $nin: syncedIds },
      source: 'BSP',
      status: { $nin: ['DELETED', 'DRAFT'] } // Safety: Never prune DRAFTs even if source is BSP
    }, {
      $set: { 
        status: 'DELETED', 
        lastSyncedAt: new Date(),
        rejectionReason: 'Removed from Meta/Gupshup'
      }
    });

    if (purgeResult.modifiedCount > 0) {
      console.log(`[WabaService] Pruned ${purgeResult.modifiedCount} stale templates for workspace ${workspaceId}`);
    }

    return { 
      success: true, 
      count: synced,
      syncedAt: new Date(),
      stats: { synced, updated, created, pruned: purgeResult.modifiedCount },
      totalFromProvider: templates.length
    };
  }

  private static mapGupshupStatus(status: string): string {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'APPROVED': return 'APPROVED';
      case 'REJECTED':
      case 'DISAPPROVED':
        return 'REJECTED';
      case 'PENDING':
      case 'PENDING_META_REVIEW':
      case 'SUBMITTED':
      case 'REQUEST_SUBMITTED':
        return 'PENDING';
      case 'PAUSED': return 'PAUSED';
      case 'DISABLED': return 'DISABLED';
      case 'DELETED': return 'DELETED';
      case 'IN_APPEAL': return 'IN_APPEAL';
      case 'LIMIT_EXCEEDED': return 'LIMIT_EXCEEDED';
      default: 
        console.warn(`[WabaService:Status] Unknown Gupshup status: ${s}. Defaulting to FAILED.`);
        return 'FAILED'; 
    }
  }


  static async resolveWorkspaceConfig(workspaceId: string | Types.ObjectId) {
    const workspace = await Workspace.findById(workspaceId).select('gupshupIdentity bspManaged bspPhoneStatus gupshupAppId whatsappPhoneNumber bspDisplayPhoneNumber').lean();
    
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
    if (!(workspace as any).bspManaged) throw new Error('WORKSPACE_NOT_BSP_MANAGED');
    if ((workspace as any).bspPhoneStatus !== 'CONNECTED') throw new Error('BSP_PHONE_NOT_CONNECTED');

    const appId = (workspace as any).gupshupAppId || (workspace as any).gupshupIdentity?.partnerAppId;
    const appApiKey = (workspace as any).gupshupIdentity?.appApiKey;

    if (!appId) {
      throw new Error('GUPSHUP_IDENTITY_MISSING');
    }

    // Canonical numeric Phone Number ID is MANDATORY for V3 Passthrough media routing.
    // Display phone numbers (e.g. 91...) often cause "Silent Kills" on Meta side.
    let sourcePhone = (workspace as any)?.whatsappPhoneNumberId ||
      (workspace as any)?.bspPhoneNumberId ||
      (workspace as any)?.phoneNumberId;

    if (!sourcePhone) {
       sourcePhone = await this.syncIdentityFromProvider(workspaceId, appId);
    }

    // Fallback to display number only if ID sync failed or is not available
    if (!sourcePhone) {
      sourcePhone = (workspace as any)?.whatsappPhoneNumber || (workspace as any)?.bspDisplayPhoneNumber;
    }


    return { 
      appId, 
      appApiKey,
      sourcePhone: sourcePhone ? String(sourcePhone).trim() : undefined 
    };
  }

  private static syncRetryBlock: Map<string, number> = new Map();

  static async syncIdentityFromProvider(workspaceId: string | Types.ObjectId, appId?: string) {
    const workspaceIdStr = workspaceId.toString();
    
    // 1. Memory-level circuit breaker (Fastest)
    const blockTime = this.syncRetryBlock.get(workspaceIdStr);
    if (blockTime && blockTime > Date.now()) {
      return null;
    }

    const redis = await connectRedis();
    const syncFailedKey = `waba:sync_failed:${workspaceIdStr}`;

    // 2. Redis-level circuit breaker
    if (redis && await redis.get(syncFailedKey)) {
      this.syncRetryBlock.set(workspaceIdStr, Date.now() + 60000); // Memoize for 1 minute
      return null;
    }

    console.log(`[WabaService] Identity missing for appId ${appId}. Attempting auto-sync...`);

    try {
      const workspace = await Workspace.findById(workspaceId).lean();
      if (!workspace) return;

      const appId = (workspace as any).gupshupAppId || (workspace as any).gupshupIdentity?.partnerAppId;
      if (!appId) return;

      const info = await GupshupPartnerService.getWabaInfo(appId);
      
      // Look for the Meta Phone Number ID in various Gupshup response variants
      const phoneNumberId = 
        info?.partnerApp?.phoneNumberId || 
        info?.phoneNumberId || 
        info?.data?.phoneNumberId ||
        info?.partnerApp?.phoneId;

      const displayPhone = info?.partnerApp?.phone || info?.phone || info?.data?.phone;

      if (phoneNumberId) {
        await Workspace.updateOne(
          { _id: workspaceId },
          { 
            $set: { 
              whatsappPhoneNumberId: phoneNumberId,
              bspPhoneNumberId: phoneNumberId,
              phoneNumberId: phoneNumberId,
              whatsappPhoneNumber: displayPhone || (workspace as any).whatsappPhoneNumber
            } 
          }
        );
        console.log(`[WabaService] Identity backfilled for ${workspaceId}: ${phoneNumberId}`);
        return phoneNumberId;
      }
      return null;
    } catch (e: any) {
      console.warn(`[WabaService] Identity sync failed for workspace ${workspaceId}:`, e.message);
      
      // Implement circuit breaker: don't retry for 15 minutes
      if (redis) {
        await (redis as any).set(syncFailedKey, 'true', 'EX', 900);
      }
      this.syncRetryBlock.set(workspaceIdStr, Date.now() + 900000); // 15 mins
      
      return null;
    }
  }

  /**
   * Send a location message from inbox
   */
  static async sendLocationMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    location: { latitude: number; longitude: number; name?: string; address?: string },
    options: ISendMessageOptions = {}
  ) {
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);
    if (sourcePhone && GupshupService.normalizePhoneNumber(to) === sourcePhone) {
      throw new Error('SELF_SEND_NOT_ALLOWED');
    }

    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) throw new Error('SESSION_EXPIRED');

    const result = await GupshupService.sendLocation(
      appId,
      undefined,
      to,
      location.latitude,
      location.longitude,
      location.name,
      location.address,
      sourcePhone
    );

    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'location',
      body: location.name || location.address || `[Location: ${location.latitude}, ${location.longitude}]`,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      failureReason: result.error,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        location: {
          lat: location.latitude,
          long: location.longitude,
          name: location.name,
          address: location.address
        },
        providerEnvelopeId: result.providerEnvelopeId,
        gs_id: result.data?.gs_id || result.data?.gsId,
        providerResponse: result.data
      }
    });

    await ConversationService.syncMessage((message as any)._id);
    return { success: result.success, message, result };
  }

  /**
   * Send a contacts message (vCard) from inbox
   */
  static async sendContactMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    contacts: any[],
    options: ISendMessageOptions = {}
  ) {
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);
    if (sourcePhone && GupshupService.normalizePhoneNumber(to) === sourcePhone) {
      throw new Error('SELF_SEND_NOT_ALLOWED');
    }

    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) throw new Error('SESSION_EXPIRED');

    const result = await GupshupService.sendContact(appId, undefined, to, contacts, sourcePhone);

    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'contacts',
      body: `👤 Contact: ${contacts[0]?.name?.formatted_name || 'Business Card'}`,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      failureReason: result.error,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        contacts,
        providerResponse: result.data
      }
    });

    await ConversationService.syncMessage(message._id);
    return { success: result.success, message, result };
  }


  /**
   * Send an interactive message (Buttons, Lists) from inbox
   */
  static async sendInteractiveMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    interactive: any,
    options: ISendMessageOptions = {}
  ) {
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);
    if (sourcePhone && GupshupService.normalizePhoneNumber(to) === sourcePhone) {
      throw new Error('SELF_SEND_NOT_ALLOWED');
    }

    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) throw new Error('SESSION_EXPIRED');

    const result = await GupshupService.sendInteractive(appId, undefined, to, interactive, sourcePhone);

    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'interactive',
      body: interactive.body?.text || '[Interactive Message]',
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      failureReason: result.error,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        interactive,
        providerEnvelopeId: result.providerEnvelopeId,
        gs_id: result.data?.gs_id || result.data?.gsId,
        providerResponse: result.data
      }
    });

    await ConversationService.syncMessage(message._id);
    return { success: result.success, message, result };
  }

  /**
   * Send a WhatsApp Flow message from automation/inbox.
   */
  static async sendFlowMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    flow: {
      header?: any;
      body?: { text: string };
      footer?: { text: string };
      action: any;
    },
    options: ISendMessageOptions = {}
  ) {
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);
    if (sourcePhone && GupshupService.normalizePhoneNumber(to) === sourcePhone) {
      throw new Error('SELF_SEND_NOT_ALLOWED');
    }

    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) throw new Error('SESSION_EXPIRED');

    const result = await GupshupService.sendFlow(appId, undefined, to, flow, sourcePhone);

    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'interactive',
      body: flow?.body?.text || '[Flow Message]',
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      failureReason: result.error,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        flow,
        providerEnvelopeId: result.providerEnvelopeId,
        providerResponse: result.data
      }
    });

    await ConversationService.syncMessage(message._id);
    return { success: result.success, message, result };
  }

  /**
   * Send a reaction to a specific WhatsApp message
   */
  static async sendReactionMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    messageId: string,
    emoji: string,
    options: ISendMessageOptions = {}
  ) {
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);
    const targetMessageQuery: any = {
      workspace: workspaceId,
      $or: [{ whatsappMessageId: messageId }]
    };

    if (Types.ObjectId.isValid(messageId)) {
      targetMessageQuery.$or.push({ _id: new Types.ObjectId(messageId) });
    }

    const targetMessage = await Message.findOne(targetMessageQuery).select('_id whatsappMessageId meta sentBy').lean();
    const providerTargetMessageId = (targetMessage as any)?.whatsappMessageId || messageId;
    
    // Note: Reactions usually require an active session on Meta, but Gupshup handles window logic.
    // We log it as a separate 'reaction' message that target UI can attach to the original message.
    const result = await GupshupService.sendReaction(appId, undefined, to, providerTargetMessageId, emoji, sourcePhone);

    if (!result.success) {
      return { success: false, result, message: null };
    }

    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'reaction',
      body: emoji,
      status: 'sent',
      whatsappMessageId: result.messageId,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        reactedTo: providerTargetMessageId,
        emoji
      }
    });

    if (targetMessage) {
      const targetDoc = await Message.findById((targetMessage as any)._id);
      if (targetDoc) {
        if (!targetDoc.meta) targetDoc.meta = {};
        if (!targetDoc.meta.reactions) targetDoc.meta.reactions = {};

        const reactionKey = `agent:${options.sentBy?.toString() || message._id.toString()}`;
        targetDoc.meta.reactions[reactionKey] = {
          emoji,
          timestamp: new Date(),
          reactionMessageId: message._id.toString(),
          reactedBy: options.sentBy ? options.sentBy.toString() : null
        };

        targetDoc.markModified('meta');
        await targetDoc.save();
      }
    }

    await ConversationService.syncMessage(message._id);
    return { success: true, message, result };
  }

  /**
   * Send a PIX payment session (Brazil)
   */
  static async sendPixMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    pix: any,
    options: ISendMessageOptions = {}
  ) {
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);
    
    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) throw new Error('SESSION_EXPIRED');

    const result = await GupshupService.sendPix(appId, undefined, to, pix, sourcePhone);

    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'pix',
      body: `💳 PIX Payment: ${pix.amount} BRL`,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        pix,
        providerResponse: result.data
      }
    });

    await ConversationService.syncMessage(message._id);
    return { success: result.success, message, result };
  }

  /**
   * Send a Boleto payment message (Brazil)
   */
  static async sendBoletoMessage(
    workspaceId: string | Types.ObjectId,
    to: string,
    boleto: any,
    options: ISendMessageOptions = {}
  ) {
    const { appId, sourcePhone } = await this.resolveWorkspaceConfig(workspaceId);
    
    const sessionActive = await this.canSendSessionMessage(workspaceId, to, options.contactId);
    if (!sessionActive) throw new Error('SESSION_EXPIRED');

    const result = await GupshupService.sendBoleto(appId, undefined, to, boleto, sourcePhone);

    const message = await Message.create({
      workspace: workspaceId,
      contact: options.contactId,
      conversation: options.conversationId,
      direction: 'outbound',
      type: 'boleto',
      body: `📄 Boleto: ${boleto.amount} BRL`,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.messageId,
      sentBy: options.sentBy,
      recipientPhone: GupshupService.normalizePhoneNumber(to),
      meta: {
        ...options.metadata,
        boleto,
        providerResponse: result.data
      }
    });

    await ConversationService.syncMessage(message._id);
    return { success: result.success, message, result };
  }
}
