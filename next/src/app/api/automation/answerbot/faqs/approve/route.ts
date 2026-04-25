import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middlewares/auth';
import { FAQ } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

/**
 * POST /api/automation/answerbot/faqs/approve
 * Bulk-approve selected draft FAQs, making them live for bot responses
 */
export const POST = withRole(['owner', 'admin', 'manager'], async (req: NextRequest, { workspace }) => {
  await dbConnect();

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ success: false, error: 'FAQ IDs array is required and must not be empty' }, { status: 400 });
  }

  const result = await FAQ.updateMany(
    { _id: { $in: ids }, workspace: workspace._id },
    { $set: { status: 'approved', approvedAt: new Date() } }
  );

  return NextResponse.json({
    success: true,
    modifiedCount: result.modifiedCount,
    message: `${result.modifiedCount} FAQs approved and now live`
  });
});
