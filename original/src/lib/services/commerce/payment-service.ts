import Razorpay from 'razorpay';
import { Order } from '@/lib/models/commerce/Order';
import { CommerceSettings } from '@/lib/models/commerce/CommerceSettings';
import { Types } from 'mongoose';
import { config } from '@/lib/config';

export class PaymentService {
  /**
   * Generate a Razorpay Payment Link for an order
   */
  static async generateRazorpayLink(workspaceId: string | Types.ObjectId, orderId: string | Types.ObjectId): Promise<string | null> {
    try {
      const settings = await CommerceSettings.findOne({ workspaceId }).lean();
      const order = await Order.findById(orderId).populate('contactId');
      
      if (!order || !settings?.paymentMethods?.razorpay?.enabled) return null;

      const { keyId, keySecret } = settings.paymentMethods.razorpay;
      if (!keyId || !keySecret) return null;

      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });

      const contact = order.contactId as any;

      // Create Payment Link
      const amountInPaise = Math.round(order.total * 100);
      
      const link = await razorpay.paymentLink.create({
        amount: amountInPaise,
        currency: (order as any).currency || 'INR',
        accept_partial: false,
        description: `Order ${order.orderNumber} from ${workspaceId}`,
        customer: {
          name: order.address?.name || contact?.name || 'Customer',
          email: contact?.email || 'customer@example.com',
          contact: order.address?.phone || contact?.phone
        },
        notify: {
          sms: true,
          email: true,
          whatsapp: true
        },
        reminder_enable: true,
        notes: {
          order_id: order._id.toString(),
          workspace_id: workspaceId.toString()
        },
        callback_url: `${config.baseUrl.replace(/\/$/, '')}/api/payments/callback`,
        callback_method: 'get'
      });

      order.paymentId = link.id;
      order.paymentStatus = 'initiated';
      await order.save();

      return link.short_url;
    } catch (err: any) {
      console.error("[PaymentService Error]:", err.message);
      return null;
    }
  }
}
