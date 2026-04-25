import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Integration } from '@/lib/models/integration/Integration';
import { GoogleSheetsService } from '@/lib/services/integrations/google-sheets-service';

export const GET = withAuth(async (req, { user }) => {
  try {
    const integration = await Integration.findOne({ 
      workspace: user.workspace, 
      type: 'google_sheets' 
    }).select('+config');

    if (!integration) return NextResponse.json({ files: [] });

    const files = await GoogleSheetsService.listSpreadsheets(integration);
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
});
