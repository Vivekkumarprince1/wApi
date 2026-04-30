import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(req: Request) {
  try {
    const clientId = config.googleClientId;
    if (!clientId) {
      return NextResponse.json({ message: 'Google client ID not configured' }, { status: 500 });
    }

    const appOrigin = new URL(req.url).origin;
    // Keep callback path legacy-compatible to match existing Google OAuth redirect registration.
    const redirectUri = `${appOrigin}/api/v1/auth/google/callback`;

    const frontendOrigin = appOrigin;
    const state = Buffer.from(JSON.stringify({ frontendOrigin }), 'utf8').toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to generate auth url', error: err.message }, { status: 500 });
  }
}
