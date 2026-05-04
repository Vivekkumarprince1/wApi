import { proxyController } from '@/controllers/proxyController';
import { Types } from 'mongoose';

export class PaymentService {
  /**
   * Generate a Razorpay Payment Link for an order by calling the Billing Microservice
   */
  static async generateRazorpayLink(workspaceId: string | Types.ObjectId, orderId: string | Types.ObjectId): Promise<string | null> {
    try {
      console.log(`[PaymentService] Redirecting commerce payment initialization to Billing Service for order ${orderId}`);
      
      const response = await proxyController.forwardToService('billing', {
        method: 'POST',
        path: `/api/billing/commerce/${orderId}/pay`,
        workspaceId: workspaceId.toString()
      });

      if (response.status === 200 && response.data.success) {
        return response.data.paymentLink;
      }

      console.error(`[PaymentService] Billing Service returned error:`, response.data);
      return null;
    } catch (err: any) {
      console.error("[PaymentService Error]:", err.message);
      return null;
    }
  }
}
