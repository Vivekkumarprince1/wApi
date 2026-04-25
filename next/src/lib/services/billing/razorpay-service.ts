/**
 * RAZORPAY SERVICE
 * 
 * Handles order creation and payment verification with Razorpay.
 */

import Razorpay from 'razorpay';
import { config } from '@/lib/config';
import crypto from 'crypto';

export class RazorpayService {
  private static instance: Razorpay;

  private static getInstance(): Razorpay {
    if (!this.instance) {
      this.instance = new Razorpay({
        key_id: config.razorpayKeyId,
        key_secret: config.razorpayKeySecret,
      });
    }
    return this.instance;
  }

  /**
   * Create a recharge order
   * @param amountPaise Amount in paise (1 INR = 100 paise)
   * @param workspaceId ID of the workspace 
   */
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

  /**
   * Create an order for a plan upgrade
   * @param amountPaise Plan fee in paise
   * @param workspaceId ID of the workspace
   * @param planSlug Slug of the target plan
   */
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

  /**
   * Create an order for payment method verification (nominal charge)
   * @param workspaceId ID of the workspace
   */
  static async createVerificationOrder(workspaceId: string) {
    const razorpay = this.getInstance();
    
    const options = {
      amount: 100, // ₹1 nominal charge
      currency: "INR",
      receipt: `verify_${workspaceId.substring(0, 6)}_${Date.now()}`,
      notes: {
        workspaceId,
        type: 'PAYMENT_METHOD_VERIFICATION'
      }
    };

    try {
      const order = await razorpay.orders.create(options);
      return order;
    } catch (error) {
      console.error('[RazorpayService] Verification Order Failed:', error);
      throw new Error('FAILED_TO_CREATE_VERIFICATION_ORDER');
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  static verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
      .createHmac("sha256", config.razorpayKeySecret)
      .update(body.toString())
      .digest("hex");
      
    return expectedSignature === signature;
  }

  /**
   * Fetch payment details to verify amount
   */
  static async getPaymentDetails(paymentId: string) {
    const razorpay = this.getInstance();
    try {
      return await razorpay.payments.fetch(paymentId);
    } catch (error) {
      console.error('[RazorpayService] Fetch Payment Failed:', error);
      throw new Error('FAILED_TO_FETCH_RAZORPAY_PAYMENT');
    }
  }

  /**
   * Validate Razorpay Webhook Signature
   */
  static validateWebhookSignature(body: string, signature: string, secret: string): boolean {
    const razorpay = this.getInstance();
    try {
       // Using the native SDK method for verification
       return (Razorpay as any).validateWebhookSignature(body, signature, secret);
    } catch (error) {
       console.error('[RazorpayService] Webhook Validation Error:', error);
       return false;
    }
  }
}
