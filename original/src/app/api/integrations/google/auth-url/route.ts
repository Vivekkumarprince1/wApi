import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { OAuth2Client } from 'google-auth-library';

export const GET = withAuth(async (req, { user }) => {
  try {
    const appOrigin = req.nextUrl.origin;
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appOrigin}/api/integrations/google/callback`
    );

    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ],
      state: Buffer.from(JSON.stringify({ workspaceId: user.workspace })).toString('base64url')
    });

    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
});
