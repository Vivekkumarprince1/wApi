import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import { Order } from '@/lib/models/commerce/Order';
import { Product } from '@/lib/models/commerce/Product';
import { Contact } from '@/lib/models/messaging/Contact';
import { Deal, DealStatus, DealPriority } from '@/lib/models/commerce/Deal';
import { Pipeline } from '@/lib/models/commerce/Pipeline';
import { LogisticsService } from '@/lib/services/commerce/logistics-service';
import dbConnect from '@/lib/db-connect';

/**
 * GET orders for current workspace with filters
 */
export const GET = withFeature('ORDERS', async (req: NextRequest, { workspace }) => {
  try {
    if (!workspace) {
      return NextResponse.json({ success: false, message: "Workspace context missing or unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const query: any = { 
      workspaceId: workspace._id 
    };

    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'address.name': { $regex: search, $options: 'i' } },
        { 'address.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('contactId');
    
    return NextResponse.json({ 
      success: true, 
      orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error("[Orders API GET Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

/**
 * PATCH update order status
 */
export const PATCH = withFeature('ORDERS', async (req: NextRequest, { workspace, user }) => {
  try {
    if (!workspace) {
      return NextResponse.json({ success: false, message: "Workspace context missing or unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const body = await req.json();
    const { orderId, status, paymentStatus, trackingNumber, trackingUrl } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID required" }, { status: 400 });
    }

    const order = await Order.findOne({ _id: orderId, workspaceId: workspace._id });
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    // Use model methods to ensure legacy parity logic (timestamps etc)
    if (status && status !== order.status) {
      order.updateStatus(status);
    }

    if (paymentStatus) order.paymentStatus = paymentStatus as any;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (trackingUrl) order.trackingUrl = trackingUrl;
    
    (order as any).lastModifiedBy = user._id;

    await order.save();

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error("[Orders API PATCH Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

/**
 * POST create manual order
 */
export const POST = withFeature('ORDERS', async (req: NextRequest, { workspace, user }) => {
  try {
    if (!workspace) {
      return NextResponse.json({ success: false, message: "Workspace context missing or unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const body = await req.json();
    
    // Use official legacy pattern WO-YYYYMMDD-RANDOM-WSID
    const orderNumber = (Order as any).generateOrderNumber(workspace._id);
    
    // Resolve Contact from phone
    const phone = body.address?.phone;
    if (!phone) {
      return NextResponse.json({ success: false, message: "Customer phone number required for manifest identity" }, { status: 400 });
    }

    let contact = await Contact.findOne({ workspace: workspace._id, phone });
    if (!contact) {
      contact = await Contact.create({
        workspace: workspace._id,
        phone,
        name: body.address?.name || 'Guest Unit',
        isColdContact: true,
        leadStatus: 'new'
      });
    }

    const order = await Order.create({
      ...body,
      workspaceId: workspace._id,
      contactId: contact._id,
      orderNumber,
      source: 'admin',
      createdBy: user._id
    });

    // Stock Deduction
    for (const item of order.items) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity }
        });
      }
    }

    // CRM Sync
    try {
      const pipeline = await Pipeline.findOne({ workspace: workspace._id, isDefault: true }) || 
                       await Pipeline.findOne({ workspace: workspace._id });
      
      if (pipeline && pipeline.stages.length > 0) {
        await Deal.create({
          workspace: workspace._id,
          contact: order.contactId,
          pipeline: pipeline._id,
          title: `Manual Order: ${orderNumber}`,
          value: order.total,
          stage: pipeline.stages[0].id,
          status: DealStatus.ACTIVE,
          priority: DealPriority.HIGH,
          source: 'manual_dashboard',
          sourceId: order._id,
          description: `Manually created order ${orderNumber}.`
        });
      }
    } catch (crmErr) {
      console.error("[CRM-Sync-Error]:", crmErr);
    }
    
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (err: any) {
    console.error("[Orders API POST Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

/**
 * POST /api/commerce/orders/sync
 * Manually trigger WhatsApp notification for an order
 */
export const PUT = withFeature('ORDERS', async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID required" }, { status: 400 });
    }

    const success = await LogisticsService.syncStatusToCustomer(workspace._id, orderId);
    
    if (!success) {
       return NextResponse.json({ success: false, message: "Failed to send notification. Check settings or contact details." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Logistics notification dispatched." });
  } catch (err: any) {
    console.error("[Orders API Sync Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
