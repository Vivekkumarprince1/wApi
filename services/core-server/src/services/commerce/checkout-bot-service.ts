import { 
  CheckoutCart, 
  ICheckoutCartDocument,
  Product,
  CommerceSettings,
  Contact,
  Deal, 
  DealStatus, 
  DealPriority,
  Pipeline
} from "@/models";
import { PaymentService } from "./payment-service";
import { WabaService } from "@/services/messaging/waba-service";
import { proxyController } from "@/controllers/proxyController";
import dbConnect from "@/db-connect";
import { Types } from "mongoose";

export class CheckoutBotService {
  /**
   * Process inbound message and advance checkout state
   */
  static async processMessage(
    workspaceId: string | Types.ObjectId,
    contactId: string | Types.ObjectId,
    conversationId: string | Types.ObjectId,
    text: string
  ): Promise<{ handled: boolean; state?: string } | null> {
    try {
      await dbConnect();
      const lowerText = text.toLowerCase().trim();
      
      // 1. Fetch Commerce Configuration
      const settings = await CommerceSettings.findOne({ workspaceId, enabled: true }).lean();
      if (!settings) return null; // Commerce disabled for this workspace

      // 2. Find or Initialize Cart
      let cart = await CheckoutCart.findOne({ 
        workspaceId, 
        contactId, 
        state: { $ne: 'order_completed' } 
      });

      if (!cart) {
        if (!this.isCommerceIntent(lowerText)) return null;
        cart = await this.init(workspaceId, contactId, conversationId) as any;
      }

      const cartDoc = cart as any;
      if (!cartDoc) return null;

      if (cartDoc.isExpired) {
        await this.reply(cartDoc, "🕒 Your previous session expired. Let's start a fresh one!");
        cartDoc.state = 'welcome';
        await cartDoc.save();
      }

      // 3. State Machine
      switch (cartDoc.state) {
        case 'welcome':
        case 'product_selection':
          return await this.handleProductSelection(cartDoc, lowerText);
        case 'quantity_selection':
          return await this.handleQuantitySelection(cartDoc, lowerText, settings);
        case 'address_capture':
          return await this.handleAddressCapture(cartDoc, text);
        case 'payment_pending':
          return await this.handlePaymentConfirmation(cartDoc, lowerText, settings);
        default:
          return { handled: false };
      }
    } catch (err: any) {
      console.error("[CheckoutBot Exception]:", err.message);
      return { handled: false };
    }
  }

  private static isCommerceIntent(text: string): boolean {
    return /(buy|shop|order|catalog|product|price|checkout|cart|purchase|available|menu)/i.test(text);
  }

  private static async init(workspaceId: any, contactId: any, conversationId: any): Promise<ICheckoutCartDocument> {
    return await CheckoutCart.create({
      workspaceId,
      contactId,
      conversationId,
      state: 'welcome',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  }

  private static async handleProductSelection(cart: ICheckoutCartDocument, text: string) {
    const products = await Product.find({ 
      workspace: cart.workspaceId, 
      isActive: true, 
      isDeleted: false,
      stock: { $gt: 0 }
    }).limit(10).lean();
    
    if (!products.length) {
      await this.reply(cart, "🛍️ Our catalog is currently being updated. Please check back later!");
      return { handled: true };
    }

    // Check if user picked a number or name
    const choice = parseInt(text);
    let selected = null;
    if (!isNaN(choice) && choice >= 1 && choice <= products.length) {
      selected = products[choice - 1];
    } else {
      selected = products.find(p => p.name.toLowerCase().includes(text));
    }

    if (selected) {
      cart.state = 'quantity_selection';
      cart.currentContext = { 
        selectedProductId: selected._id as Types.ObjectId,
        selectedProductName: selected.name,
        selectedProductPrice: selected.price
      };
      await cart.save();
      await this.reply(cart, `📦 Choice: *${selected.name}*\nPrice: ₹${selected.price}\n\nHow many would you like to order? (Available: ${selected.stock})`);
      return { handled: true, state: cart.state };
    }

    // Show catalog if no valid selection
    const catalog = products.map((p, i) => `*${i + 1}*. ${p.name} - ₹${p.price}`).join('\n');
    const message = `👋 Welcome to our Store!\n\nHere are our available items:\n\n${catalog}\n\n*Reply with a number or name to select.*`;
    
    await this.reply(cart, message);
    cart.state = 'product_selection';
    await cart.save();
    return { handled: true, state: cart.state };
  }

  private static async handleQuantitySelection(cart: ICheckoutCartDocument, text: string, settings: any) {
    const qty = parseInt(text.match(/\d+/)?.[0] || '');
    if (isNaN(qty) || qty <= 0) {
      await this.reply(cart, "❌ Invalid quantity. Please reply with a number (e.g., 1, 2, 5).");
      return { handled: true };
    }

    const productId = cart.currentContext?.selectedProductId;
    const product = await Product.findById(productId);
    
    if (!product || product.stock < qty) {
       await this.reply(cart, `⚠️ Sorry, we only have ${product?.stock || 0} in stock. Please enter a lower quantity.`);
       return { handled: true };
    }

    cart.addItem(product, qty);
    
    // Apply Global Settings
    const shippingCost = settings.shipping?.enabled && settings.shipping?.flatRate?.enabled 
      ? settings.shipping.flatRate.amount 
      : 0;
    
    // Check for free shipping threshold
    const finalShipping = settings.shipping?.freeShippingAbove?.enabled && cart.subtotal >= settings.shipping.freeShippingAbove.amount
      ? 0
      : shippingCost;

    cart.calculateTotals(settings.taxPercentage || 0, finalShipping);
    cart.state = 'address_capture';
    await cart.save();

    const summary = `🛒 *Cart Updated*\nItems: ${qty} x ${product.name}\nSubtotal: ₹${cart.subtotal}\nTax: ₹${cart.tax}\nShipping: ₹${cart.shipping}\n*Total: ₹${cart.total}*\n\n📍 Please share your *Delivery Address*:\nFormat: *Name, Phone, Street, City, Pincode*`;
    
    await this.reply(cart, summary);
    return { handled: true, state: cart.state };
  }

  private static async handleAddressCapture(cart: ICheckoutCartDocument, text: string) {
    // Regex based address parsing (matches Intrakt pattern)
    const parts = text.split(/,|\n/).map(p => p.trim()).filter(Boolean);
    
    if (parts.length < 4) {
      await this.reply(cart, "📝 *Address Required*\nWe need your details to deliver. Please reply in this format:\n\n*Name, Phone, Street, City, Pincode*");
      return { handled: true };
    }

    cart.address = {
      name: parts[0],
      phone: parts[1],
      street: parts[2],
      city: parts[3],
      pincode: parts[4] || '000000',
      country: 'India',
      isComplete: true
    };
    
    cart.state = 'payment_pending';
    await cart.save();

    await this.reply(cart, `✅ *Address Set*\n\nDest: ${cart.address.street}, ${cart.address.city}\n\nHow would you like to pay?\n1. *Cash on Delivery (COD)*\n2. *Online Payment*`);
    return { handled: true, state: cart.state };
  }

  private static async handlePaymentConfirmation(cart: ICheckoutCartDocument, text: string, settings: any) {
    if (text.includes('1') || text.toLowerCase().includes('cod')) {
      if (!settings.paymentMethods?.cashOnDelivery?.enabled) {
        await this.reply(cart, "⚠️ COD is currently disabled for this store. Please select another method.");
        return { handled: true };
      }

      // Finalize Order (COD)
      const orderResult = await this.finalizeOrder(cart, 'cod');
      
      const instructions = settings.paymentMethods.cashOnDelivery.instructions || "Please keep exact change ready.";
      await this.reply(cart, `📦 *Order Confirmed!*\n\nOrder No: *${orderResult.orderNumber}*\nTotal: *₹${cart.total}*\n\nYour order has been placed successfully. We'll notify you when it's out for delivery.\n\n*Instructions:* ${instructions}`);
      return { handled: true, state: cart.state };
    }
    
    if (text.includes('2') || text.toLowerCase().includes('online')) {
      const activeGateways = [];
      if (settings.paymentMethods?.razorpay?.enabled) activeGateways.push('Razorpay');
      if (settings.paymentMethods?.stripe?.enabled) activeGateways.push('Stripe');

      if (!activeGateways.length) {
        await this.reply(cart, "⚠️ Online payments are being set up. Please use COD for now.");
        return { handled: true };
      }

      // Finalize Order (Online - Pending)
      const orderResult = await this.finalizeOrder(cart, activeGateways[0].toLowerCase() as any);

      // Generate Payment Link
      let paymentLink = null;
      if (activeGateways[0] === 'Razorpay') {
        paymentLink = await PaymentService.generateRazorpayLink(cart.workspaceId, orderResult.id);
      }

      const finalLink = paymentLink || `[TEST_PAYMENT_NODE_${orderResult.orderNumber}]`;

      await this.reply(cart, `🔗 *Payment Link Generated*\n\nPlease click the link below to pay ₹${cart.total} via ${activeGateways[0]}:\n\n${finalLink}`);
      return { handled: true };
    }
    
    await this.reply(cart, "❓ Please choose *1* for COD or *2* for Online Payment.");
    return { handled: true };
  }

  private static async finalizeOrder(cart: ICheckoutCartDocument, paymentMethod: 'cod' | 'razorpay' | 'stripe') {
    const addr = cart.address;
    const address = {
      name: addr.name || 'Customer',
      phone: addr.phone || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state,
      pincode: addr.pincode || '',
      country: addr.country || 'India',
    };

    const items = cart.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      price: it.price,
      quantity: it.quantity,
      subtotal: it.subtotal,
      ...(it.image ? { image: it.image } : {}),
    }));

    const wsId = String(cart.workspaceId);

    const orderPayload = {
      contactId: cart.contactId,
      conversationId: cart.conversationId,
      checkoutCartId: cart._id,
      items,
      subtotal: cart.subtotal,
      tax: cart.tax,
      taxPercentage: (cart as { taxPercentage?: number }).taxPercentage || 0,
      shippingCost: cart.shipping,
      discount: 0,
      total: cart.total,
      address,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'initiated',
      status: (paymentMethod === 'cod' ? 'confirmed' : 'pending') as 'confirmed' | 'pending',
      ...(paymentMethod === 'cod' ? { confirmedAt: new Date() } : {}),
      source: 'whatsapp_checkout_bot' as const,
    };

    const response = await proxyController.forwardToService('billing', {
      method: 'POST',
      path: `/api/billing/commerce/wallets/${wsId}/orders`,
      workspaceId: wsId,
      data: orderPayload,
    });

    if (response.status !== 201 && response.status !== 200) {
      const msg =
        (response.data as { error?: string; message?: string })?.error ||
        (response.data as { message?: string })?.message ||
        'Failed to create order in billing service';
      throw new Error(msg);
    }

    const order =
      (response.data as { data?: { _id: Types.ObjectId; orderNumber: string } })?.data ||
      (response.data as { _id?: Types.ObjectId; orderNumber?: string });

    if (!order?._id || !order?.orderNumber) {
      throw new Error('Billing service returned an invalid order payload');
    }

    // 3. Deduct Stock
    for (const item of cart.items) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity }
        });
      }
    }

    // 4. Create CRM Deal (Parity with Intrakt Sales Pipeline)
    try {
      const pipeline = await Pipeline.findOne({ workspace: cart.workspaceId, isDefault: true }) || 
                       await Pipeline.findOne({ workspace: cart.workspaceId });
      
      if (pipeline && pipeline.stages.length > 0) {
        const firstStage = pipeline.stages[0].id;
        await Deal.create({
          workspace: cart.workspaceId,
          contact: cart.contactId,
          pipeline: pipeline._id,
          title: `WhatsApp Order: ${order.orderNumber}`,
          value: cart.total,
          stage: firstStage,
          status: DealStatus.ACTIVE,
          priority: DealPriority.MEDIUM,
          source: 'whatsapp_checkout_bot',
          sourceId: order._id as Types.ObjectId,
          description: `Automatically created from WhatsApp Checkout Bot order ${order.orderNumber}. Address: ${address.city}`
        });
      }
    } catch (crmErr) {
      console.error("[CRM-Sync-Error]:", crmErr);
      // Don't fail the order if CRM sync fails
    }

    // 5. Update Cart State
    cart.state = 'order_completed';
    await cart.save();

    return { orderNumber: order.orderNumber, id: order._id };
  }

  private static async reply(cart: ICheckoutCartDocument, text: string) {
    const contact = await Contact.findById(cart.contactId).lean();
    if (!contact) return;

    await WabaService.sendTextMessage(cart.workspaceId, contact.phone, text, {
      contactId: cart.contactId,
      conversationId: cart.conversationId,
      metadata: { source: 'checkout_bot' }
    });
  }
}
