import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { WhatsAppForm } from '@/lib/models';

export const POST = withAuth(async (_req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();

    const form = await WhatsAppForm.findOneAndUpdate(
      { _id: params.id, workspace: workspace._id, deletedAt: null },
      {
        $set: {
          status: 'draft',
        },
      },
      { returnDocument: 'after' }
    );

    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: form, message: 'Form unpublished' });
  } catch (error: any) {
    console.error('API Error [WhatsApp Form/UNPUBLISH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
