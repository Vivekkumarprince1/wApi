import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { AuditLog } from '@/lib/models';

export const GET = withRole(['super_admin'], async (req: NextRequest) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'name email')
      .lean();

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch audit logs', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}) as any;
