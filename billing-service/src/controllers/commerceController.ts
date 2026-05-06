import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { CommercePaymentService } from '../services/CommercePaymentService';
import { OrderModel } from '../models/Order';

export const commerceController = {
  /**
   * Initialize payment for an order
   */
  async initializePayment(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const workspaceId = req.headers['x-workspace-id'] as string;

      if (!orderId || !workspaceId) {
        return res.status(400).json({ error: 'Order ID and Workspace ID are required' });
      }

      const paymentLink = await CommercePaymentService.generateRazorpayLink(workspaceId, orderId as any);

      if (!paymentLink) {
        return res.status(400).json({ error: 'Failed to generate payment link' });
      }

      res.json({ success: true, paymentLink });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Get order status
   */
  async getOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const workspaceId = req.headers['x-workspace-id'] as string;

      const order = await OrderModel.findOne({ _id: orderId, workspaceId });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      res.json({ success: true, order });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * List orders for a workspace
   */
  async listOrders(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const { page = '1', limit = '10', status, search } = req.query;

      const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
      if (status && status !== 'all') query.status = status;
      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { 'address.name': { $regex: search, $options: 'i' } },
          { 'address.phone': { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [orders, total] = await Promise.all([
        OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        OrderModel.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Create a new order
   */
  async createOrder(req: Request, res: Response) {
    try {
      const workspaceId = req.params.workspaceId as string;
      const orderData = {
        ...req.body,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        orderNumber: OrderModel.generateOrderNumber(workspaceId)
      };

      const order = new OrderModel(orderData);
      await order.save();
      res.status(201).json({ success: true, data: order });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Update an order
   */
  async updateOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const workspaceId = req.headers['x-workspace-id'] as string;

      const order = await OrderModel.findOne({ _id: orderId, workspaceId });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      // Apply updates from body
      if (req.body.status) {
        try {
          order.updateStatus(req.body.status);
        } catch (e: any) {
          return res.status(400).json({ error: e.message });
        }
      }

      if (req.body.trackingNumber) order.trackingNumber = req.body.trackingNumber;
      if (req.body.adminNotes) order.adminNotes = req.body.adminNotes;
      if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;

      await order.save();
      res.json({ success: true, data: order });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
};
