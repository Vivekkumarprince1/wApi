import { Order } from "@/lib/models/commerce/Order";
import { WabaService } from "../messaging/waba-service";
import { CommerceSettings } from "@/lib/models/commerce/CommerceSettings";
import { Contact } from "@/lib/models/messaging/Contact";
import { Types } from "mongoose";

export class LogisticsService {
  /**
   * Send WhatsApp notification to customer about order status
   */
  static async syncStatusToCustomer(workspaceId: string | Types.ObjectId, orderId: string | Types.ObjectId): Promise<boolean> {
    try {
      const order = await Order.findOne({ _id: orderId, workspaceId }).populate('contactId');
      if (!order) return false;

      const contact = order.contactId as any;
      if (!contact || !contact.phone) return false;

      const settings = await CommerceSettings.findOne({ workspaceId }).lean();
      if (!settings?.notifications?.notifyCustomerOnOrder) return false;

      let message = "";
      const orderNo = order.orderNumber;
      
      switch (order.status) {
        case 'confirmed':
          message = `✅ *Order Confirmed*\n\nYour order *${orderNo}* has been confirmed. We are preparing it for dispatch.\n\nTotal: ₹${order.total}`;
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
