import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Integration } from '@/lib/models/integration/Integration';

export const GET = withAuth(async (req, { user }) => {
  try {
    const integration = await Integration.findOne({ 
      workspace: user.workspace, 
      type: 'google_sheets',
      status: 'connected'
    });

    return NextResponse.json({ 
      connected: !!integration,
      integration: integration ? {
        id: integration._id,
        name: integration.name,
        status: integration.status
      } : null
    });
  } catch (err: any) {
    return NextResponse.json({ connected: false, message: err.message });
  }
});
