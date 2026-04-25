import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Integration } from '@/lib/models/integration/Integration';

export const POST = withAuth(async (req, { user }) => {
  try {
    const { spreadsheetId, sheetName } = await req.json();

    const integration = await Integration.findOne({ 
      workspace: user.workspace, 
      type: 'google_sheets' 
    });

    if (!integration) {
      return NextResponse.json({ message: 'Integration not found' }, { status: 404 });
    }

    integration.configMetadata = {
      ...integration.configMetadata,
      spreadsheetId,
      sheetName,
      lastProcessedIndex: 0
    };

    // Keep decrypted config in sync if necessary
    const config = integration.getDecryptedConfig();
    integration.setEncryptedConfig({
      ...config,
      spreadsheetId,
      sheetName
    });

    await integration.save();
    return NextResponse.json({ message: 'Configured successfully' });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
});
