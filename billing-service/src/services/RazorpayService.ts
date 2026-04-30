import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config';

const RAZORPAY_KEY_ID = config.razorpayKeyId || 'dummy_key_id';
const RAZORPAY_KEY_SECRET = config.razorpayKeySecret || 'dummy_secret';

export class RazorpayService {
  private static instance: Razorpay;

  private static getInstance(): Razorpay {
    if (!this.instance) {
      this.instance = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
      });
    }
    return this.instance;
  }

  static async createRechargeOrder(amountPaise: number, workspaceId: string) {
    const razorpay = this.getInstance();
    
    const options = {
      amount: amountPaise,
      currency: "INR",
      receipt: `rc_ws_${workspaceId.substring(0, 8)}_${Date.now()}`,
      notes: {
        workspaceId,
        type: 'RECHARGE'
      }
    };

    try {
      const order = await razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('[RazorpayService] Order Creation Failed:', error);
      throw new Error('FAILED_TO_CREATE_RAZORPAY_ORDER');
    }
  }

  static async createPlanOrder(amountPaise: number, workspaceId: string, planSlug: string) {
    const razorpay = this.getInstance();
    
    const options = {
      amount: amountPaise,
      currency: "INR",
      receipt: `plan_${workspaceId.substring(0, 6)}_${Date.now()}`,
      notes: {
        workspaceId,
        planSlug,
        type: 'PLAN_UPGRADE'
      }
    };

    try {
      const order = await razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('[RazorpayService] Plan Order Creation Failed:', error);
      throw new Error('FAILED_TO_CREATE_PLAN_ORDER');
    }
  }

  static verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");
      
    return expectedSignature === signature;
  }

  static async getPaymentDetails(paymentId: string) {
    const razorpay = this.getInstance();
    try {
      return await razorpay.payments.fetch(paymentId);
    } catch (error) {
      console.error('[RazorpayService] Fetch Payment Failed:', error);
      throw new Error('FAILED_TO_FETCH_RAZORPAY_PAYMENT');
    }
  }
}
