import { AutomationClient } from "../automation/automation-client";
import { Contact } from "../../models";
import dbConnect from "../../db-connect";

export type IntegrationProvider = 'shopify' | 'woocommerce' | 'meta-ads' | 'google-sheets' | 'petpooja';

export class IntegrationService {
  /**
   * Main entry point for processing external webhooks
   */
  static async handleExternalEvent(
    provider: IntegrationProvider,
    workspaceId: string,
    payload: any
  ) {
    await dbConnect();

    // 1. Normalize Payload based on Provider
    const normalizedData = this.normalize(provider, payload);
    if (!normalizedData) return;

    // 2. Enrichment: Try to find/create contact if possible
    let contactId = null;
    if (normalizedData.customerEmail) {
      const contact = await Contact.findOneAndUpdate(
        { workspace: workspaceId, email: normalizedData.customerEmail },
        {
          $set: {
            name: normalizedData.customerName || undefined,
            phone: normalizedData.customerPhone || undefined
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
      contactId = contact?._id;
    }

    // 3. Trigger Automation Microservice via Client
    try {
        await AutomationClient.triggerEvent(workspaceId, normalizedData.eventType, {
            ...normalizedData.data,
            contactId: contactId?.toString(),
            provider
        });
        console.log(`[IntegrationService] ✅ Processed ${provider} event: ${normalizedData.eventType} for Workspace ${workspaceId} (via Microservice)`);
    } catch (error: any) {
        console.error(`[IntegrationService] ❌ Failed to trigger microservice for ${provider} event:`, error.message);
    }
  }

  /**
   * Helper to normalize Heterogeneous payloads
   */
  private static normalize(provider: IntegrationProvider, payload: any) {
    switch (provider) {
      case 'shopify':
        return {
          eventType: payload.financial_status === 'pending' ? 'ORDER_CREATED' : 'ORDER_PAID',
          customerEmail: payload.customer?.email,
          customerName: `${payload.customer?.firstName} ${payload.customer?.lastName}`,
          customerPhone: payload.customer?.phone,
          data: {
            orderId: payload.id,
            totalPrice: payload.total_price,
            currency: payload.currency,
            items: payload.line_items?.map((i: any) => i.name).join(', ')
          }
        };

      case 'meta-ads':
        return {
          eventType: 'NEW_LEAD',
          customerEmail: payload.email,
          customerName: payload.full_name,
          customerPhone: payload.phone_number,
          data: {
            formId: payload.form_id,
            leadId: payload.id,
            platform: 'facebook'
          }
        };

      case 'google-sheets':
        return {
          eventType: 'GOOGLE_SHEETS_ROW_ADDED',
          customerEmail: payload.email || payload.Email,
          customerName: payload.name || payload.Name || payload['Full Name'],
          customerPhone: payload.phone || payload.Phone || payload['Phone Number'],
          data: {
            sheetId: payload.sheetId,
            rowNumber: payload.rowNumber,
            values: payload.values || payload
          }
        };

      case 'petpooja':
        return {
          eventType: 'PETPOOJA_ORDER_CREATED',
          customerEmail: payload.customer_details?.email,
          customerName: payload.customer_details?.name,
          customerPhone: payload.customer_details?.phone,
          data: {
            orderId: payload.order_id,
            totalAmount: payload.total_amount,
            items: payload.order_items?.map((i: any) => i.item_name).join(', '),
            status: payload.status
          }
        };

      default:
        return null;
    }
  }
}
