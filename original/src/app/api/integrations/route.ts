import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import { Integration } from '@/lib/models/integration/Integration';

/**
 * GET /api/integrations
 * List all configured integrations for the workspace
 */
export const GET = withFeature('INTEGRATIONS', withAuth(async (req, { user }) => {
  try {
    const integrations = await Integration.find({ 
      workspace: user.workspace 
    }).select('+config');

    // Return safe JSON with metadata
    return NextResponse.json({ 
      integrations: integrations.map(i => i.toSafeJSON()) 
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}));
