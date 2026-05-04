import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Product } from '../models';
import { PaymentService } from '../services/commerce/payment-service';
import { AutomationClient } from '../services/automation/automation-client';
import { proxyController } from './proxyController';

export const commerceController = {
  /**
   * List Catalogs
   */
  async listCatalogs(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const { Business } = await import('../models');
      const business = await Business.findOne({ workspace: workspace._id });
      
      // Stub for catalogs since they might be managed via Gupshup/Facebook
      res.json({ 
        success: true, 
        data: [
          { _id: 'default', name: 'Default Catalog', isDefault: true }
        ]
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * List Products
   */
  async listProducts(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const page = parseInt(req.query.page as string || '1');
      const limit = parseInt(req.query.limit as string || '50');
      const category = req.query.category as string;
      const search = req.query.search as string;
      const getStats = req.query.stats === 'true';

      const query: any = { 
        workspace: workspace._id, 
        isDeleted: false 
      };

      if (category) query.category = category;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (getStats) {
        const stats = await Product.aggregate([
          { $match: { workspace: workspace._id, isDeleted: false } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: ['$isActive', 1, 0] } },
              lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 10] }] }, 1, 0] } },
              outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } }
            }
          }
        ]);
        return res.json({ success: true, data: stats[0] || {} });
      }

      const [products, total] = await Promise.all([
        Product.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Product.countDocuments(query)
      ]);
      
      res.json({ 
        success: true, 
        data: products,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create Product
   */
  async createProduct(req: AuthRequest, res: Response) {
    try {
      const { workspace, user } = req;
      const product = await Product.create({
        ...req.body,
        workspace: workspace._id,
        createdBy: user._id
      });
      res.status(201).json({ success: true, data: product });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateProduct(req: AuthRequest, res: Response) {
    try {
      const { workspace, user } = req;
      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, workspace: workspace._id, isDeleted: false },
        { $set: { ...req.body, updatedBy: user._id } },
        { new: true, runValidators: true }
      );

      if (!product) return res.status(404).json({ success: false, message: "Product not found" });
      res.json({ success: true, data: product });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const { workspace, user } = req;
      const product = await Product.findOneAndUpdate(
        { _id: req.params.id, workspace: workspace._id, isDeleted: false },
        { $set: { isDeleted: true, isActive: false, deletedAt: new Date(), updatedBy: user._id } },
        { new: true }
      );

      if (!product) return res.status(404).json({ success: false, message: "Product not found" });
      res.json({ success: true, message: "Product deleted", data: product });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getStats(req: AuthRequest, res: Response) {
    try {
      const { workspace, user } = req;
      const [productStats, billingStatsRes] = await Promise.all([
        Product.aggregate([
          { $match: { workspace: workspace._id, isDeleted: false } },
          {
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
              lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 10] }] }, 1, 0] } },
              outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } }
            }
          }
        ]),
        proxyController.forwardToService('billing', {
          method: 'GET',
          path: `/api/billing/wallets/${workspace._id}/stats`,
          workspaceId: workspace._id.toString(),
          userId: user._id.toString(),
          userRole: req.role || req.user?.role,
        }).catch(() => ({ data: { success: true, data: {} } }))
      ]);

      const billingStats = billingStatsRes.data?.data || {};

      res.json({
        success: true,
        data: {
          totalProducts: productStats[0]?.totalProducts || 0,
          activeProducts: productStats[0]?.activeProducts || 0,
          lowStock: productStats[0]?.lowStock || 0,
          outOfStock: productStats[0]?.outOfStock || 0,
          totalOrders: billingStats.totalOrders || 0,
          revenue: billingStats.revenue || 0,
          pendingOrders: billingStats.pendingOrders || 0
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * List Orders (Proxied to Billing Service)
   */
  async listOrders(req: AuthRequest, res: Response) {
    try {
      const { workspace, user } = req;
      const response = await proxyController.forwardToService('billing', {
        method: 'GET',
        path: `/api/billing/commerce/wallets/${workspace._id}/orders`,
        params: req.query,
        workspaceId: workspace._id.toString(),
        userId: user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      const status = err.message === 'CIRCUIT_OPEN' ? 503 : 502;
      res.status(status).json({ 
        success: false, 
        message: err.message === 'CIRCUIT_OPEN' ? 'Billing service temporarily unavailable' : 'Billing service unreachable',
        error: err.message 
      });
    }
  },

  async getOrder(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const response = await proxyController.forwardToService('billing', {
        method: 'GET',
        path: `/api/billing/commerce/${id}/status`,
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createOrder(req: AuthRequest, res: Response) {
    try {
      const response = await proxyController.forwardToService('billing', {
        method: 'POST',
        path: `/api/billing/commerce/wallets/${req.workspace._id}/orders`,
        data: req.body,
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateOrder(req: AuthRequest, res: Response) {
    try {
      const orderId = req.params.id || req.body.orderId || req.body.id;
      const response = await proxyController.forwardToService('billing', {
        method: 'PATCH',
        path: `/api/billing/commerce/orders/${orderId}`,
        data: req.body,
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateOrderStatus(req: AuthRequest, res: Response) {
    try {
      const response = await proxyController.forwardToService('billing', {
        method: 'PATCH',
        path: `/api/billing/commerce/orders/${req.params.id}`,
        data: req.body,
        workspaceId: req.workspace._id.toString(),
        userId: req.user._id.toString(),
        userRole: req.role || req.user?.role,
      });

      // Trigger automation (Fire and forget)
      if (response.data?.success) {
        const order = response.data.data || response.data.order;
        AutomationClient.triggerEvent(req.workspace._id.toString(), 'order_status_updated', {
          orderId: order._id,
          status: order.status,
          contactId: order.contact
        }).catch(() => {});
      }

      res.status(response.status).json(response.data);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get Payment Link for Order (Proxy to Billing Service)
   */
  async getPaymentLink(req: AuthRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const { workspace } = req;
      
      const paymentLink = await PaymentService.generateRazorpayLink(workspace._id, orderId);
      
      if (!paymentLink) {
        return res.status(400).json({ success: false, message: "Could not generate payment link" });
      }

      res.json({ success: true, paymentLink });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get Commerce Settings
   */
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const { Business } = await import('../models');
      const business = await Business.findOne({ workspace: workspace._id });
      const cs = (business?.commerceSettings || {}) as Record<string, unknown>;

      res.json({
        success: true,
        data: {
          currency: (cs.currency as string) || 'INR',
          checkoutBotEnabled: !!cs.checkoutBotEnabled,
          razorpayEnabled: !!business?.razorpayKeyId,
          catalogEnabled: !!cs.catalogEnabled,
          ...cs
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const { Business } = await import('../models');
      let business = await Business.findOne({ workspace: workspace._id });
      if (!business) {
        business = await Business.create({
          workspace: workspace._id,
          owner: req.user._id,
          name: (workspace as any).name || 'Business',
          address: {},
          commerceSettings: {}
        });
      }
      const prev = (business.commerceSettings || {}) as Record<string, unknown>;
      const incoming = req.body && typeof req.body === 'object' ? req.body : {};
      business.commerceSettings = { ...prev, ...incoming } as any;
      if (incoming.razorpayKeyId !== undefined) {
        (business as any).razorpayKeyId = incoming.razorpayKeyId;
      }
      await business.save();
      const fresh = await Business.findOne({ workspace: workspace._id });
      const cs = (fresh?.commerceSettings || {}) as Record<string, unknown>;
      res.json({
        success: true,
        data: {
          currency: (cs.currency as string) || 'INR',
          checkoutBotEnabled: !!cs.checkoutBotEnabled,
          razorpayEnabled: !!fresh?.razorpayKeyId,
          catalogEnabled: !!cs.catalogEnabled,
          ...cs
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get Checkout Bot Stats
   */
  async getCheckoutBotStats(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      // Aggregating mock/real stats for parity
      const stats = {
        ordersClosed: 0,
        totalRevenue: '₹0',
        abandonmentRate: '0%',
        activeSessions: 0,
        subtext: { 
          orders: 'No data', 
          revenue: 'Real-time', 
          abandonment: 'Stable', 
          sessions: 'Monitoring' 
        }
      };
      
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
