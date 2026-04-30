import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import dbConnect from '@/lib/db-connect';
import { WhatsAppForm } from '@/lib/models';

export const GET = withFeature('WA_FORMS', async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const query: any = {
      workspace: workspace._id,
      deletedAt: null,
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const forms = await WhatsAppForm.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: forms,
    });
  } catch (error: any) {
    console.error('API Error [WhatsApp Forms/GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withFeature('WA_FORMS', async (req: NextRequest, { workspace, user }) => {
  try {
    await dbConnect();

    const body = await req.json();

    if (!body?.name?.trim()) {
      return NextResponse.json({ success: false, error: 'Form name is required' }, { status: 400 });
    }

    const form = await WhatsAppForm.create({
      workspace: workspace._id,
      name: body.name,
      description: body.description || '',
      status: 'draft',
      flowType: body.flowType || 'static',
      flowId: body.flowId || body?.rawFlowJson?.flow_id || body?.rawFlowJson?.flowId,
      screens: Array.isArray(body.screens) ? body.screens : [],
      rawFlowJson: body.rawFlowJson || null,
      dataMapping: Array.isArray(body.dataMapping) ? body.dataMapping : [],
      webhookConfig: {
        enabled: body?.webhookConfig?.enabled ?? false,
        url: body?.webhookConfig?.url || undefined,
        method: body?.webhookConfig?.method || 'POST',
        headers: body?.webhookConfig?.headers || {},
      },
      config: {
        fallbackMessage: body?.config?.fallbackMessage || 'Please update your WhatsApp to use interactive forms.',
        sendConfirmationMessage: body?.config?.sendConfirmationMessage ?? true,
        confirmationText: body?.config?.confirmationText || '',
      },
      tags: Array.isArray(body.tags) ? body.tags : [],
      category: body.category || '',
      createdBy: user?._id,
    });

    return NextResponse.json({ success: true, data: form }, { status: 201 });
  } catch (error: any) {
    console.error('API Error [WhatsApp Forms/POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
