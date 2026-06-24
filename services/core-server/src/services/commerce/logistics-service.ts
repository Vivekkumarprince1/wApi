import { proxyController } from "@/controllers/proxyController";
import { WabaService } from "../messaging/waba-service";
import { Contact } from "@/models";
import { Types } from "mongoose";

export class LogisticsService {
  /**
   * Send WhatsApp notification to customer about order status
   */
  static async syncStatusToCustomer(workspaceId: string | Types.ObjectId, orderId: string | Types.ObjectId): Promise<boolean> {
    try {
      // 1. Fetch order from Billing Service via proxy
      const orderRes = await proxyController.forwardToService('billing', {
        method: 'GET',
        path: `/api/billing/commerce/orders/${orderId}`,
        workspaceId: workspaceId.toString()
      });

      const order = orderRes.data?.data;
      if (!order) return false;

      // 2. Fetch contact locally (core-server owns contacts)
      const contact = await Contact.findById(order.contactId || order.contact).select("name phone").lean();
      if (!contact || !contact.phone) return false;

      // 3. Fetch commerce settings (core-server owns settings for now)
      // Actually, if CommerceSettings was in migrated-models, it might be in billing-service?
      // Let's check commerceController.ts in core-server.
      // In Phase 2, I saw commerceController uses CommerceSettings from models.
      // If it's NOT in migrated-models, it's local.
      // Wait, I saw CommerceSettings in migrated-models.ts earlier!
      
      const settingsRes = await proxyController.forwardToService('billing', {
        method: 'GET',
        path: `/api/billing/commerce/settings`,
        workspaceId: workspaceId.toString()
      });
      
      const settings = settingsRes.data?.data;
      if (!(settings?.notifications?.notifyCustomerOnOrder)) return false;

      let message = "";
      const orderNo = order.orderNumber || order.orderId;
      
      switch (order.status) {
        case 'confirmed':
          message = `✅ *Order Confirmed*\n\nYour order *${orderNo}* has been confirmed. We are preparing it for dispatch.\n\nTotal: ₹${order.totalAmount || order.total}`;
          break;
        case 'shipped':
          const tracking = order.trackingNumber ? `\nTracking ID: *${order.trackingNumber}*` : '';
          message = `🚚 *Order Shipped*\n\nGreat news! Your order *${orderNo}* has been dispatched and is on its way.${tracking}`;
          break;
        case 'delivered':
          message = `🎉 *Order Delivered*\n\nYour order *${orderNo}* has been successfully delivered. We hope you love your purchase!`;
          break;
        default:
          return false;
      }

      await WabaService.sendTextMessage(workspaceId, contact.phone, message, {
        contactId: contact._id,
        metadata: { source: 'logistics_sync', orderId: order._id }
      });

      return true;
    } catch (err: any) {
      console.error("[LogisticsService Sync Error]:", err.message);
      return false;
    }
  }
}
