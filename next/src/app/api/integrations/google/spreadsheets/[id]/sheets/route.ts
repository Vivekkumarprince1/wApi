import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { withAuth } from '@/lib/middlewares/auth';
import { Integration } from '@/lib/models/integration/Integration';

export const GET = withAuth(async (req, { user, params }) => {
  try {
    const resolvedParams = await Promise.resolve(params);
    const spreadsheetId = resolvedParams.id;

    const integration = await Integration.findOne({ 
      workspace: user.workspace, 
      type: 'google_sheets' 
    }).select('+config');

    if (!integration) return NextResponse.json({ sheets: [] });

    const config = integration.getDecryptedConfig();
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      expiry_date: config.expiryDate
    });

    const sheetsApi = google.sheets({ version: 'v4', auth: client });
    const response = await sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title'
    });

    const sheets = response.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
    return NextResponse.json({ sheets });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
});
