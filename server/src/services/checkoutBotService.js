const CheckoutCart = require('../models/CheckoutCart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Workspace = require('../models/Workspace');
const Contact = require('../models/Contact');
const whatsappService = require('./whatsappService');
const metaService = require('./metaService');

/**
 * CHECKOUT BOT SERVICE
 * 
 * Implements state machine for WhatsApp checkout flow:
 * welcome → product_selection → quantity_selection → address_capture → payment_pending → order_completed
 * 
 * KEY CONCEPTS:
 * - State: Current step in checkout (enum)
 * - Context: Data needed for current step (selected product, quantity, address)
 * - Cart: Persistent storage of items and totals
 * - State Transitions: Defined rules for moving between states
 */

class CheckoutBotService {
  /**
   * Initialize or resume checkout for a contact
   */
  static async initializeCheckout(workspaceId, contactId, conversationId) {
    try {
      // Check if cart exists
      let cart = await CheckoutCart.findOne({
        workspaceId,
        contactId,
        state: { $ne: 'order_completed' }
      });

      if (cart && !cart.isExpired) {
        // Resume existing cart
        return {
          success: true,
          action: 'resume',
          cart,
          message: 'Welcome back! Your cart is ready.'
        };
      }

      // Create new cart
      cart = await CheckoutCart.create({
        workspaceId,
        contactId,
        conversationId,
        state: 'welcome',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      return {
        success: true,
        action: 'new',
        cart,
        message: 'Welcome to our checkout! Let\'s get started.'
      };
    } catch (err) {
      throw new Error(`Failed to initialize checkout: ${err.message}`);
    }
  }

  /**
   * Move to product selection state
   * Get products from catalog
   */
  static async showProductSelection(workspaceId, contactId, category = null) {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Checkout cart not found');

      // Fetch products
      let query = { workspaceId, isDeleted: false, isActive: true };
      if (category) query.category = category;

      const products = await Product.find(query)
        .select('_id name price category images')
        .limit(10)
        .lean();

      if (!products.length) {
        return {
          success: false,
          message: 'No products available'
        };
      }

      // Update cart state
      cart.state = 'product_selection';
      cart.currentContext = { step: 'product_selection', selectedCategory: category };
      await cart.save();

      return {
        success: true,
        state: 'product_selection',
        products,
        message: 'Select a product to continue'
      };
    } catch (err) {
      throw new Error(`Product selection failed: ${err.message}`);
    }
  }

  /**
   * Select product and move to quantity selection
   */
  static async selectProduct(workspaceId, contactId, productId) {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Checkout cart not found');

      // Fetch product
      const product = await Product.findOne({
        _id: productId,
        workspaceId,
        isDeleted: false,
        isActive: true
      });

      if (!product) throw new Error('Product not found');
      if (product.stock <= 0) throw new Error('Product out of stock');

      // Update cart with selected product
      cart.state = 'quantity_selection';
      cart.currentContext = {
        step: 'quantity_selection',
        selectedProductId: product._id,
        selectedProductName: product.name,
        selectedProductPrice: product.price
      };
      await cart.save();

      return {
        success: true,
        state: 'quantity_selection',
        product: {
          id: product._id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          image: product.images?.[0]?.url
        },
        message: `Great! You selected "${product.name}". How many would you like? (Available: ${product.stock})`
      };
    } catch (err) {
      throw new Error(`Product selection failed: ${err.message}`);
    }
  }

  /**
   * Add product to cart with quantity
   */
  static async addToCart(workspaceId, contactId, quantity) {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Checkout cart not found');

      const { selectedProductId } = cart.currentContext;
      if (!selectedProductId) throw new Error('No product selected');

      // Validate quantity
      const product = await Product.findById(selectedProductId);
      if (!product) throw new Error('Product not found');
      if (quantity > product.stock) throw new Error(`Only ${product.stock} available`);
      if (quantity < 1) throw new Error('Quantity must be at least 1');

      // Add to cart
      cart.addItem(product, quantity);

      // Get workspace for tax/shipping
      const workspace = await Workspace.findById(workspaceId);
      const taxPercentage = workspace?.settings?.taxPercentage || 0;
      const shippingCost = workspace?.settings?.shippingCost || 0;

      // Calculate totals
      cart.calculateTotals(taxPercentage, shippingCost);

      // Move to address capture
      cart.state = 'address_capture';
      cart.currentContext = { step: 'address_capture' };
      await cart.save();

      return {
        success: true,
        state: 'address_capture',
        items: cart.items,
        total: cart.total,
        message: 'Perfect! Now let\'s confirm your delivery address.'
      };
    } catch (err) {
      throw new Error(`Failed to add to cart: ${err.message}`);
    }
  }

  /**
   * Capture delivery address
   */
  static async captureAddress(workspaceId, contactId, addressData) {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Checkout cart not found');

      // Validate address
      const required = ['name', 'phone', 'street', 'city', 'pincode'];
      for (const field of required) {
        if (!addressData[field]) throw new Error(`${field} is required`);
      }

      // Update address
      cart.address = {
        ...addressData,
        country: addressData.country || 'India',
        isComplete: true
      };

      // Move to payment pending
      cart.state = 'payment_pending';
      cart.currentContext = { step: 'payment_pending' };
      await cart.save();

      return {
        success: true,
        state: 'payment_pending',
        address: cart.address,
        total: cart.total,
        message: 'Address confirmed! Ready to proceed with payment.'
      };
    } catch (err) {
      throw new Error(`Address capture failed: ${err.message}`);
    }
  }

  /**
   * Create order and initiate payment
   */
  static async initiatePayment(workspaceId, contactId, paymentMethod = 'cod') {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Checkout cart not found');

      if (!cart.address?.isComplete) {
        throw new Error('Address not provided');
      }

      if (!cart.items.length) {
        throw new Error('Cart is empty');
      }

      // Create order from cart
      const orderNumber = Order.generateOrderNumber(workspaceId);

      const order = await Order.create({
        workspaceId,
        contactId,
        conversationId: cart.conversationId,
        checkoutCartId: cart._id,
        orderNumber,
        items: cart.items,
        subtotal: cart.subtotal,
        tax: cart.tax,
        shipping: cart.shipping,
        total: cart.total,
        address: cart.address,
        paymentMethod,
        paymentStatus: 'pending',
        status: 'pending'
      });

      // Update cart with order reference
      cart.orderId = order._id;
      cart.paymentMethod = paymentMethod;
      cart.state = 'payment_pending';
      await cart.save();

      // Log payment initiation
      if (paymentMethod !== 'cod') {
        order.paymentStatus = 'initiated';
        order.status = 'payment_initiated';
        await order.save();
      }

      return {
        success: true,
        state: 'payment_pending',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          paymentMethod
        },
        message: `Order ${order.orderNumber} created! Total: ₹${order.total}`
      };
    } catch (err) {
      throw new Error(`Payment initiation failed: ${err.message}`);
    }
  }

  /**
   * Confirm payment and complete order
   */
  static async confirmPayment(workspaceId, contactId, paymentId, paymentGateway = 'razorpay') {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Checkout cart not found');

      const order = await Order.findById(cart.orderId);
      if (!order) throw new Error('Order not found');

      // Mark payment as complete
      order.markAsPaid(paymentId, paymentGateway);
      order.notificationsSent.payment_confirmed = false; // Will be sent next
      await order.save();

      // Mark cart as completed
      cart.state = 'order_completed';
      cart.paymentStatus = 'completed';
      cart.paymentId = paymentId;
      await cart.save();

      return {
        success: true,
        state: 'order_completed',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status
        },
        message: `Thank you! Your order ${order.orderNumber} has been confirmed.`
      };
    } catch (err) {
      throw new Error(`Payment confirmation failed: ${err.message}`);
    }
  }

  /**
   * Handle payment failure
   */
  static async handlePaymentFailure(workspaceId, contactId, error) {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Checkout cart not found');

      const order = await Order.findById(cart.orderId);
      if (order) {
        order.paymentStatus = 'failed';
        order.status = 'failed';
        order.paymentError = error;
        await order.save();
      }

      // Keep cart alive for retry
      cart.paymentStatus = 'failed';
      cart.paymentError = error;
      // Don't change state, allow retry
      await cart.save();

      return {
        success: false,
        error,
        message: 'Payment failed. Please try again or contact support.'
      };
    } catch (err) {
      throw new Error(`Payment failure handling failed: ${err.message}`);
    }
  }

  /**
   * Get current cart and state
   */
  static async getCartStatus(workspaceId, contactId) {
    try {
      let cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();

      if (!cart || cart.isExpired) {
        return {
          success: false,
          state: 'expired',
          message: 'Your cart has expired. Start a new checkout.'
        };
      }

      return {
        success: true,
        state: cart.state,
        cart: {
          items: cart.items,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal,
          tax: cart.tax,
          shipping: cart.shipping,
          total: cart.total,
          address: cart.address?.isComplete ? cart.address : null
        },
        context: cart.currentContext
      };
    } catch (err) {
      throw new Error(`Failed to get cart status: ${err.message}`);
    }
  }

  /**
   * Abandon cart
   */
  static async abandonCart(workspaceId, contactId) {
    try {
      const cart = await CheckoutCart.findOne({ workspaceId, contactId }).active();
      if (!cart) throw new Error('Cart not found');

      cart.state = 'abandoned';
      await cart.save();

      return { success: true, message: 'Cart abandoned' };
    } catch (err) {
      throw new Error(`Failed to abandon cart: ${err.message}`);
    }
  }

  /**
   * Clean up expired carts (called by queue worker)
   */
  static async cleanupExpiredCarts(workspaceId) {
    try {
      const now = new Date();
      
      const result = await CheckoutCart.updateMany(
        {
          workspaceId,
          expiresAt: { $lte: now },
          state: { $ne: 'order_completed' }
        },
        {
          state: 'abandoned',
          updatedAt: now
        }
      );

      return {
        success: true,
        expiredCount: result.modifiedCount
      };
    } catch (err) {
      throw new Error(`Cart cleanup failed: ${err.message}`);
    }
  }

  /**
   * Send message to customer (wrapper around whatsappService)
   * Reuses existing message infrastructure
   */
  static async sendBotMessage(workspaceId, contactId, messageBody, messageType = 'text') {
    try {
      const contact = await Contact.findById(contactId);
      if (!contact) throw new Error('Contact not found');

      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) throw new Error('Workspace not found');

      // For now, just log the message
      // In production, use Message.create() and enqueueSend()
      console.log(`[CheckoutBot] Message to ${contact.phone}: ${messageBody}`);

      return {
        success: true,
        message: 'Message queued for sending'
      };
    } catch (err) {
      throw new Error(`Failed to send message: ${err.message}`);
    }
  }
}

module.exports = CheckoutBotService;
