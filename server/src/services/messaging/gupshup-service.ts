import axios from 'axios';
import { bspConfig } from '../../config/bsp-config';
import { GupshupClientFactory } from '../../api/gupshup-client-factory';
import { normalizePhoneNumber } from '../../utils/phone-utils';

/**
 * Gupshup Messaging Service
 * 
 * Low-level API client for Gupshup V3 / Meta Cloud API.
 * All requests are routed through the Partner V3 endpoints for multi-tenancy.
 */

export interface IGupshupMessageResult {
  success: boolean;
  messageId?: string;
  providerEnvelopeId?: string;
  error?: string;
  data?: any;
}

export interface IGupshupTemplateComponent {
  type: string;
  parameters: any[];
}

export class GupshupService {
  private static extractMessageId(data: any): string | undefined {
    // Prefer WhatsApp message IDs from nested payloads, then fall back to envelope IDs
    return data?.messages?.[0]?.id || data?.message?.id || data?.messageId || data?.id || undefined;
  }

  /**
   * Autonomous Client Getter
   */
  private static getClient(appId: string) {
    return GupshupClientFactory.getClient(appId);
  }

  /**
   * Normalizes a phone number to E.164 format without + sign
   * Proxy to central utility for backward compatibility within this class
   */
  static normalizePhoneNumber(phone: string, defaultCountryCode = "91"): string {
    return normalizePhoneNumber(phone, defaultCountryCode);
  }

  /**
   * Build the Meta Cloud API compatible envelope required by Gupshup V3
   */
  private static buildV3Envelope(to: string, message: any, source?: string) {
    const envelope: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.normalizePhoneNumber(to),
      ...message
    };

    // Mandatory for many Gupshup Partner V3 accounts to route media/interactive correctly.
    // We use raw 'source' if it looks like a numeric ID to avoid normalization side-effects.
    if (source) {
       const cleanedSource = String(source).replace(/\D/g, '');
       envelope.source = cleanedSource.length >= 15 ? cleanedSource : this.normalizePhoneNumber(source);
    }

    return envelope;
  }

  /**
   * Send text message via Gupshup V3 Partner API (Autonomous)
   */
  static async sendText(
    appId: string,
    appApiKey: string | undefined, // Now optional
    to: string,
    text: string,
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'text',
      text: { body: text }
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 15000
      });

      const messageId = this.extractMessageId(response.data);
      if (!messageId) {
        return {
          success: false,
          error: 'PROVIDER_NO_MESSAGE_ID',
          data: response.data
        };
      }
      return {
        success: true,
        messageId,
        providerEnvelopeId: response.data?.id || response.data?.messageId,
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendText error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send a template message via Gupshup V3 (CAPI Parity - Autonomous)
   */
  static async sendTemplate(
    appId: string,
    appApiKey: string | undefined, // Now optional
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components: any[] = [],
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    
    const payload = this.buildV3Envelope(to, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components
      }
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 25000
      });

      const messageId = this.extractMessageId(response.data);
      if (!messageId) {
        return {
          success: false,
          error: 'PROVIDER_NO_MESSAGE_ID',
          data: response.data
        };
      }
      return {
        success: true,
        messageId,
        providerEnvelopeId: response.data?.id || response.data?.messageId,
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendTemplate error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send media message (image, video, audio, document, sticker) - Autonomous
   * Strictly follows Meta Cloud API payload structure with 'source' routing.
   */
  static async sendMedia(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    type: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    mediaUrl: string,
    caption?: string,
    filename?: string,
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    
    // Strict Meta Cloud API: Use ONLY 'link'. Gupshup takes care of URL fetching.
    const mediaObject: any = { 
        link: mediaUrl 
    };
    
    if (caption && ['image', 'video', 'document'].includes(type)) {
      mediaObject.caption = caption;
    }
    
    if (filename && type === 'document') {
      mediaObject.filename = filename;
    }

    const payload = this.buildV3Envelope(to, {
      type,
      [type]: mediaObject
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 25000
      });

      const messageId = this.extractMessageId(response.data);
      if (!messageId) {
        return {
          success: false,
          error: 'PROVIDER_NO_MESSAGE_ID',
          data: response.data
        };
      }
      return {
        success: true,
        messageId,
        providerEnvelopeId: response.data?.id || response.data?.messageId,
        data: response.data
      };
    } catch (error: any) {
      console.error(`[GupshupService] sendMedia(${type}) error:`, error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || (error.response?.data?.error?.message) || error.message,
        data: error.response?.data 
      };
    }
  }

  /**
   * Send a location message - Autonomous
   */
  static async sendLocation(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'location',
      location: {
        latitude,
        longitude,
        name,
        address
      }
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 15000
      });

      return {
        success: true,
        messageId: this.extractMessageId(response.data),
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendLocation error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send a contacts message (vCard) - Autonomous
   */
  static async sendContact(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    contacts: any[],
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'contacts',
      contacts
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 15000
      });

      return {
        success: true,
        messageId: this.extractMessageId(response.data),
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendContact error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send an interactive message (Buttons, Lists) - Autonomous
   */
  static async sendInteractive(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    interactive: any,
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'interactive',
      interactive
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 15000
      });

      return {
        success: true,
        messageId: this.extractMessageId(response.data),
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendInteractive error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send a reaction to a specific message - Autonomous
   */
  static async sendReaction(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    messageId: string,
    emoji: string,
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: emoji
      }
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 10000
      });

      return {
        success: true,
        messageId: this.extractMessageId(response.data),
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendReaction error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send a PIX payment message (Brazil)
   */
  static async sendPix(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    pix: any,
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'pix',
      pix
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 15000
      });

      return {
        success: true,
        messageId: this.extractMessageId(response.data),
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendPix error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send a Boleto payment message (Brazil) - Autonomous
   */
  static async sendBoleto(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    boleto: any,
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'payment',
      payment: {
        type: 'boleto',
        boleto
      }
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 15000
      });

      return {
        success: true,
        messageId: this.extractMessageId(response.data),
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendBoleto error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Send a WhatsApp Flow message - Autonomous
   */
  static async sendFlow(
    appId: string,
    appApiKey: string | undefined, // Now optional
    to: string,
    flowPayload: {
      header?: any;
      body?: { text: string };
      footer?: { text: string };
      action: any;
    },
    source?: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/flow/message`;
    const payload = this.buildV3Envelope(to, {
      type: 'interactive',
      interactive: {
        type: 'flow',
        ...flowPayload
      }
    }, source);

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 20000
      });

      const messageId = this.extractMessageId(response.data);
      if (!messageId) {
        return {
          success: false,
          error: 'PROVIDER_NO_MESSAGE_ID',
          data: response.data
        };
      }

      return {
        success: true,
        messageId,
        providerEnvelopeId: response.data?.id || response.data?.messageId,
        data: response.data
      };
    } catch (error: any) {
      console.error('[GupshupService] sendFlow error:', error.response?.data || error.message);
      return { success: false, error: error.message, data: error.response?.data };
    }
  }

  /**
   * Mark a message as read (Autonomous)
   */
  static async markRead(
    appId: string,
    appApiKey: string | undefined,
    to: string,
    messageId: string
  ): Promise<IGupshupMessageResult> {
    const url = `/partner/app/${appId}/v3/message`;
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    try {
      const client = this.getClient(appId);
      const response = await client.post(url, payload, {
        timeout: 10000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error(`[GupshupService] markRead error for ${messageId}:`, error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message,
        data: error.response?.data 
      };
    }
  }

  /**
   * Fetch all templates for an app from Gupshup Partner API - Autonomous
   */
  static async fetchTemplates(appId: string, appApiKey?: string) {
    const url = `/partner/app/${appId}/templates`;
    const client = this.getClient(appId);
    
    const response = await client.get(url, {
      params: { pageSize: 100, pageNo: 1 },
      timeout: 15000
    });
    return response.data;
  }


  /**
   * Create / Submit a new template to Meta for approval
   * Uses Partner V3 Form-Data API
   */
  static async createTemplate(appId: string, appApiKey: string, template: any) {
    const url = `${bspConfig.gupshup.partnerBaseUrl}/partner/app/${appId}/templates`;
    const token = String(appApiKey || '').trim();

    // 1. Map standard GCM components to Gupshup flat fields
    const components = template.components || [];
    const getComp = (type: string) => components.find((c: any) => c.type === type || c.type === type.toUpperCase());
    
    const bodyComp = getComp('body');
    const headerComp = getComp('header');
    const footerComp = getComp('footer');
    const buttonsComp = getComp('buttons');

    // 2. Determine Template Type and Header
    let templateType = 'TEXT';
    let headerText = '';
    let exampleMedia = '';
    
    if (headerComp) {
      if (headerComp.format === 'TEXT') {
        headerText = headerComp.text;
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerComp.format)) {
        templateType = headerComp.format;
        // Priority for example media handle or URL
        exampleMedia = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0] || '';
      }
    }

    // 3. Resolve Content and Examples
    const content = bodyComp?.text || '';
    // Basic auto-example generation if missing, but we expect it to be provided
    const example = content.replace(/\{\{(\d+)\}\}/g, (_: string, i: string) => {
      const idx = parseInt(i) - 1;
      return bodyComp?.example?.body_text?.[0]?.[idx] || 'Sample';
    });

    // 4. Map Buttons with Gupshup-specific structure
    const buttons = buttonsComp?.buttons?.map((b: any) => {
      const mapped: any = { type: b.type, text: b.text };
      if (b.url) mapped.url = b.url;
      if (b.phone_number) mapped.phone_number = b.phone_number;
      if (b.example) mapped.example = b.example;
      return mapped;
    });

    // 5. Build Form Payload
    const form = new URLSearchParams();
    form.set('elementName', template.name || '');
    form.set('languageCode', template.language || 'en');
    form.set('category', template.category || 'UTILITY');
    form.set('templateType', templateType);
    form.set('vertical', template.vertical || 'account update'); // Default vertical
    form.set('content', content);
    form.set('example', example);
    form.set('enableSample', 'true');
    
    if (headerText) {
      form.set('header', headerText);
      form.set('exampleHeader', headerText); // Simplification: header text as example header
    }
    if (footerComp?.text) form.set('footer', footerComp.text);
    if (exampleMedia) form.set('exampleMedia', exampleMedia);
    if (buttons && buttons.length > 0) form.set('buttons', JSON.stringify(buttons));

    return this.getClient(appId).post(url, form.toString(), {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json' 
      },
      timeout: 25000
    }).then(res => res.data);
  }

  /**
   * Delete a template from Gupshup/Meta - Autonomous
   */
  static async deleteTemplate(appId: string, appApiKey: string | undefined, elementName: string) {
    const url = `/partner/app/${appId}/template/${elementName}`;
    const client = this.getClient(appId);
    
    const response = await client.delete(url, {
      timeout: 15000
    });
    return response.data;
  }

  /**
   * Trigger provider-side template synchronization
   */
  static async triggerPartnerSync(appId: string, appApiKey: string) {
    if (!appApiKey) throw new Error('APP_TOKEN_MISSING_FOR_TEMPLATE_SYNC');

    const endpoints = [
      `${bspConfig.gupshup.partnerBaseUrl}/partner/app/${appId}/templates/sync`,
      `${bspConfig.gupshup.partnerBaseUrl}/partner/app/${appId}/template/sync`
    ];

    let lastError: any = null;
    const client = this.getClient(appId);

    for (const endpoint of endpoints) {
      try {
        const response = await client.get(endpoint, {
          timeout: 20000
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (error.response?.status !== 404) {
          throw error;
        }
      }
    }
    throw lastError;
  }
}
