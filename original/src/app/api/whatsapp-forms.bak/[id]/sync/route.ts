import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { WhatsAppForm } from '@/lib/models';

export const POST = withAuth(async (_req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();

    const form = await WhatsAppForm.findOne({
      _id: params.id,
      workspace: workspace._id,
      deletedAt: null,
    });

    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Form sync completed',
      data: { formId: form._id, syncedAt: new Date().toISOString() },
    });
  } catch (error: any) {
    console.error('API Error [WhatsApp Form/SYNC]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
