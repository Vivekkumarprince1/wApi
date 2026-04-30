import { Types } from 'mongoose';
import { Conversation } from '../../models/messaging/Conversation';
import { Template } from '../../models/template/Template';
import { WabaService } from './waba-service';
import { GupshupService } from './gupshup-service';
const { getIO } = require('../socket-bridge');

/**
 * Inbox Service
 * 
 * High-level service for handling agent interactions in the shared inbox.
 * Includes permission checks, session fallbacks, and real-time state management.
 */

export class InboxService {
  /**
   * Send text message from inbox with auto-fallback to template
   */
  static async sendTextMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    text: string;
  }) {
    const { workspaceId, conversationId, agentId, text } = options;

    // 1. Get conversation and contact phone
    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    // 2. Send text via WABA service (strict session-window enforcement).
    // If session is expired, this throws SESSION_EXPIRED and the caller handles it.
    return WabaService.sendTextMessage(workspaceId, phone, text, {
      contactId,
      conversationId,
      sentBy: agentId
    });
  }

  /**
   * Send template message from inbox
   */
  static async sendTemplateMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    templateName: string;
    languageCode?: string;
    variables?: any[];
  }) {
    const { workspaceId, conversationId, agentId, templateName, languageCode = 'en', variables = [] } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    // Dispatch via WABA service
    const result = await WabaService.sendTemplateMessage(workspaceId, phone, templateName, languageCode, variables, {
      contactId,
      conversationId,
      sentBy: agentId
    });

    if (!result.success) {
      throw new Error(result.result?.error || 'Failed to dispatch template message via provider');
    }

    return result;
  }

  /**
   * Send media message (image, video, etc.) from inbox
   */
  static async sendMediaMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
    mediaUrl: string;
    mimeType?: string;
    caption?: string;
    filename?: string;
  }) {
    const { workspaceId, conversationId, agentId, type, mediaUrl, mimeType, caption, filename } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    // Dispatch via WABA service (enforces session window)
    const result = await WabaService.sendMediaMessage(workspaceId, phone, type, mediaUrl, mimeType, caption, filename, {
      contactId,
      conversationId,
      sentBy: agentId
    });

    if (!result.success) {
      throw new Error(result.result?.error || 'Failed to dispatch media message via provider');
    }

    return result;
  }

  /**
   * Send a location message from inbox
   */
  static async sendLocationMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    location: { latitude: number; longitude: number; name?: string; address?: string };
  }) {
    const { workspaceId, conversationId, agentId, location } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    return await WabaService.sendLocationMessage(workspaceId, phone, location, {
      contactId,
      conversationId,
      sentBy: agentId
    });
  }

  /**
   * Send a contacts message (vCard) from inbox
   */
  static async sendContactMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    contacts: any[];
  }) {
    const { workspaceId, conversationId, agentId, contacts } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    return await WabaService.sendContactMessage(workspaceId, phone, contacts, {
      contactId,
      conversationId,
      sentBy: agentId
    });
  }

  /**
   * Send an interactive message from inbox
   */
  static async sendInteractiveMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    interactive: any;
  }) {
    const { workspaceId, conversationId, agentId, interactive } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    return await WabaService.sendInteractiveMessage(workspaceId, phone, interactive, {
      contactId,
      conversationId,
      sentBy: agentId
    });
  }

  /**
   * Send a reaction message from inbox
   */
  static async sendReactionMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    messageId: string;
    emoji: string;
  }) {
    const { workspaceId, conversationId, agentId, messageId, emoji } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    return await WabaService.sendReactionMessage(workspaceId, phone, messageId, emoji, {
      contactId,
      conversationId,
      sentBy: agentId
    });
  }

  /**
   * Send a PIX payment message (Brazil)
   */
  static async sendPixMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    pix: any;
  }) {
    const { workspaceId, conversationId, agentId, pix } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    return await WabaService.sendPixMessage(workspaceId, phone, pix, {
      contactId,
      conversationId,
      sentBy: agentId
    });
  }

  /**
   * Send a Boleto payment message (Brazil)
   */
  static async sendBoletoMessage(options: {
    workspaceId: string | Types.ObjectId;
    conversationId: string | Types.ObjectId;
    agentId: string | Types.ObjectId;
    boleto: any;
  }) {
    const { workspaceId, conversationId, agentId, boleto } = options;

    const conversation = await Conversation.findById(conversationId).populate('contact');
    if (!conversation || !conversation.contact) throw new Error('CONVERSATION_NOT_FOUND');
    
    // @ts-ignore
    const phone = conversation.contact.phone;
    // @ts-ignore
    const contactId = conversation.contact._id;

    return await WabaService.sendBoletoMessage(workspaceId, phone, boleto, {
      contactId,
      conversationId,
      sentBy: agentId
    });
  }
}
