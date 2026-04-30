import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import { Product } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

export const GET = withFeature('CATALOG', async (req: NextRequest, { workspace }) => {
  try {
    if (!workspace) {
      return NextResponse.json({ success: false, message: "Workspace context missing or unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const getStats = searchParams.get('stats') === 'true';

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
      return NextResponse.json({ success: true, stats: stats[0] || {} });
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    return NextResponse.json({ 
      success: true, 
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error("[Products API GET Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});

export const POST = withFeature('CATALOG', async (req: NextRequest, { workspace, user }) => {
  try {
    if (!workspace) {
      return NextResponse.json({ success: false, message: "Workspace context missing or unauthorized" }, { status: 403 });
    }
    await dbConnect();
    const body = await req.json();

    const product = await Product.create({
      ...body,
      workspace: workspace._id,
      createdBy: user._id
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (err: any) {
    console.error("[Products API POST Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
