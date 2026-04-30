import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import dbConnect from '@/lib/db-connect';
import { Integration } from '@/lib/models/integration/Integration';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json({ message: 'Invalid callback parameters' }, { status: 400 });
    }

    const { workspaceId } = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    const appOrigin = req.nextUrl.origin;

    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appOrigin}/api/integrations/google/callback`
    );

    const { tokens } = await client.getToken(code);
    
    await dbConnect();

    // Upsert integration
    let integration = await Integration.findOne({ 
      workspace: workspaceId, 
      type: 'google_sheets' 
    });

    if (!integration) {
      integration = new Integration({
        workspace: workspaceId,
        type: 'google_sheets',
        name: 'Google Sheets',
        status: 'connected',
        createdBy: workspaceId // Fallback if no user context in redirect
      });
    }

    integration.setEncryptedConfig({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date
    });
    integration.status = 'connected';
    await integration.save();

    // Redirect back to integrations page
    return NextResponse.redirect(`${appOrigin}/dashboard/integrations?success=gs_connected`);
  } catch (err: any) {
    console.error('[GoogleCallback] Error:', err.message);
    return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/integrations?error=gs_failed`);
  }
}
