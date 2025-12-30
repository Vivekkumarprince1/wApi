const CheckoutBotService = require('../services/checkoutBotService');
const CheckoutCart = require('../models/CheckoutCart');
const Order = require('../models/Order');
const mongoose = require('mongoose');

/**
 * CHECKOUT BOT CONTROLLER
 * Handles WhatsApp checkout bot endpoints
 */

/**
 * Initialize checkout
 * POST /api/v1/checkout-bot/init
 */
async function initializeCheckout(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, conversationId } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: 'contactId is required' });
    }

    const result = await CheckoutBotService.initializeCheckout(
      workspaceId,
      contactId,
      conversationId
    );

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Show available products
 * GET /api/v1/checkout-bot/products
 */
async function showProducts(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId } = req.body;
    const { category } = req.query;

    if (!contactId) {
      return res.status(400).json({ message: 'contactId is required' });
    }

    const result = await CheckoutBotService.showProductSelection(
      workspaceId,
      contactId,
      category
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Select product
 * POST /api/v1/checkout-bot/select-product
 */
async function selectProduct(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, productId } = req.body;

    if (!contactId || !productId) {
      return res.status(400).json({
        message: 'contactId and productId are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid productId' });
    }

    const result = await CheckoutBotService.selectProduct(
      workspaceId,
      contactId,
      productId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Add to cart
 * POST /api/v1/checkout-bot/add-to-cart
 */
async function addToCart(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, quantity } = req.body;

    if (!contactId || !quantity) {
      return res.status(400).json({
        message: 'contactId and quantity are required'
      });
    }

    if (typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({
        message: 'quantity must be a positive number'
      });
    }

    const result = await CheckoutBotService.addToCart(
      workspaceId,
      contactId,
      quantity
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Update cart (remove item, change quantity)
 * PUT /api/v1/checkout-bot/cart
 */
async function updateCart(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, action, productId, quantity } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: 'contactId is required' });
    }

    let cart = await CheckoutCart.findOne({
      workspaceId,
      contactId,
      state: { $ne: 'order_completed' }
    });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    if (action === 'remove' && productId) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid productId' });
      }
      cart.removeItem(productId);
    } else if (action === 'clear') {
      cart.clearCart();
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await cart.save();

    res.json({
      success: true,
      items: cart.items,
      total: cart.total,
      itemCount: cart.itemCount
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get cart status
 * GET /api/v1/checkout-bot/cart-status
 */
async function getCartStatus(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId } = req.query;

    if (!contactId) {
      return res.status(400).json({ message: 'contactId is required' });
    }

    const result = await CheckoutBotService.getCartStatus(
      workspaceId,
      contactId
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Capture delivery address
 * POST /api/v1/checkout-bot/address
 */
async function captureAddress(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, address } = req.body;

    if (!contactId || !address) {
      return res.status(400).json({
        message: 'contactId and address are required'
      });
    }

    const result = await CheckoutBotService.captureAddress(
      workspaceId,
      contactId,
      address
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Initiate payment and create order
 * POST /api/v1/checkout-bot/initiate-payment
 */
async function initiatePayment(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, paymentMethod = 'cod' } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: 'contactId is required' });
    }

    const validMethods = ['cod', 'razorpay', 'stripe', 'paypal', 'upi'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        message: `Invalid paymentMethod. Supported: ${validMethods.join(', ')}`
      });
    }

    const result = await CheckoutBotService.initiatePayment(
      workspaceId,
      contactId,
      paymentMethod
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Confirm payment
 * POST /api/v1/checkout-bot/confirm-payment
 */
async function confirmPayment(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, paymentId, paymentGateway = 'razorpay' } = req.body;

    if (!contactId || !paymentId) {
      return res.status(400).json({
        message: 'contactId and paymentId are required'
      });
    }

    const result = await CheckoutBotService.confirmPayment(
      workspaceId,
      contactId,
      paymentId,
      paymentGateway
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Handle payment failure
 * POST /api/v1/checkout-bot/payment-failed
 */
async function paymentFailed(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, error } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: 'contactId is required' });
    }

    const result = await CheckoutBotService.handlePaymentFailure(
      workspaceId,
      contactId,
      error || 'Payment failed'
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Abandon cart
 * POST /api/v1/checkout-bot/abandon
 */
async function abandonCart(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ message: 'contactId is required' });
    }

    const result = await CheckoutBotService.abandonCart(
      workspaceId,
      contactId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get order details
 * GET /api/v1/checkout-bot/order/:orderId
 */
async function getOrder(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid orderId' });
    }

    const order = await Order.findOne({
      _id: orderId,
      workspaceId
    }).populate('contactId', 'name phone');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      success: true,
      order
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all orders for workspace
 * GET /api/v1/checkout-bot/orders
 */
async function getOrders(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const {
      page = 1,
      limit = 10,
      status,
      contactId,
      sortBy = '-createdAt'
    } = req.query;

    const query = { workspaceId };

    if (status) query.status = status;
    if (contactId) query.contactId = contactId;

    const total = await Order.countDocuments(query);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const orders = await Order.find(query)
      .sort(sortBy)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .populate('contactId', 'name phone')
      .lean();

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get checkout stats
 * GET /api/v1/checkout-bot/stats
 */
async function getCheckoutStats(req, res, next) {
  try {
    const workspaceId = req.user.workspace;

    // Active carts
    const activeCarts = await CheckoutCart.countDocuments({
      workspaceId,
      expiresAt: { $gt: new Date() },
      state: { $ne: 'abandoned' }
    });

    // Abandoned carts
    const abandonedCarts = await CheckoutCart.countDocuments({
      workspaceId,
      $or: [
        { expiresAt: { $lte: new Date() } },
        { state: 'abandoned' }
      ]
    });

    // Orders by status
    const orderStats = await Order.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      }
    ]);

    // Revenue
    const revenue = await Order.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$total' }
        }
      }
    ]);

    const revenueData = revenue.length > 0 ? revenue[0] : {
      totalRevenue: 0,
      orderCount: 0,
      avgOrderValue: 0
    };

    // Conversion (completed orders / active carts)
    const conversionRate = activeCarts > 0 
      ? ((revenueData.orderCount / (activeCarts + revenueData.orderCount)) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      stats: {
        carts: {
          active: activeCarts,
          abandoned: abandonedCarts
        },
        orders: orderStats.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        revenue: {
          total: revenueData.totalRevenue,
          orderCount: revenueData.orderCount,
          avgOrderValue: revenueData.avgOrderValue.toFixed(2)
        },
        conversion: {
          rate: parseFloat(conversionRate),
          pendingOrders: orderStats.find(s => s._id === 'pending')?.count || 0
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initializeCheckout,
  showProducts,
  selectProduct,
  addToCart,
  updateCart,
  getCartStatus,
  captureAddress,
  initiatePayment,
  confirmPayment,
  paymentFailed,
  abandonCart,
  getOrder,
  getOrders,
  getCheckoutStats
};
