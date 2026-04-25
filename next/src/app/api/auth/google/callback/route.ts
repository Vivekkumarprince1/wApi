import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import dbConnect from '@/lib/db-connect';
import { User, Workspace, Permission } from '@/lib/models';
import { signToken, setAuthCookie } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    
    if (!code) {
      return NextResponse.json({ message: 'Missing code' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ message: 'Google OAuth not configured on server' }, { status: 500 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/api/v1/auth/google/callback`;

    let frontendOrigin = `${protocol}://${host}`;
    if (stateParam) {
      try {
        const parsedState = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
        if (parsedState?.frontendOrigin) {
          frontendOrigin = parsedState.frontendOrigin;
        }
      } catch (err) {
        console.warn('[GoogleOAuth] Invalid state payload');
      }
    }

    // Exchange code for tokens
    const tokenResp = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }
    });

    const idToken = tokenResp.data.id_token;
    if (!idToken) {
      return NextResponse.json({ message: 'No id_token returned' }, { status: 400 });
    }

    // Verify ID token
    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch (err) {
      // Fallback verify
      const info = await axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { id_token: idToken } });
      payload = info.data;
    }

    const googleId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name || email?.split('@')[0] || 'Google User';

    if (!email || !googleId) {
      return NextResponse.json({ message: 'Invalid token payload' }, { status: 400 });
    }

    await dbConnect();

    let user: any = await (User as any).findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      const workspace = await (Workspace as any).create({ name: `${name}'s workspace` });
      user = await (User as any).create({ 
        name, 
        email, 
        googleId, 
        workspace: workspace._id, 
        activeWorkspace: workspace._id, // Set activeWorkspace for multi-tenancy
        role: 'owner',
        emailVerified: true,
        accountStatus: 'AWAITING_MOBILE_VERIFICATION'
      });
      workspace.owner = user._id;
      await workspace.save();
      await (Permission as any).seedOwnerPermissions(workspace._id, user._id);
    } else {
      let needsSave = false;
      if (!user.googleId) {
        user.googleId = googleId;
        needsSave = true;
      }
      if (!user.activeWorkspace && user.workspace) {
        user.activeWorkspace = user.workspace;
        needsSave = true;
      }
      if (needsSave) await user.save();
    }

    // Sign Token
    const authToken = signToken({ id: user._id.toString() });

    // Set Cookie and Redirect Back to frontend's client callback to process standard session hydration
    // In legacy, the redirect was to /auth/google/callback, which doesn't exist in 'new' yet, so we can just redirect to dashboard
    // Wait, the legacy frontend had a route to handle '/auth/google/callback' logic?
    // If not, we just redirect to '/' or '/dashboard', AuthInitializer will pick up the token!
    
    const response = NextResponse.redirect(`${frontendOrigin}/dashboard`);
    return setAuthCookie(response, authToken);

  } catch (err: any) {
    console.error('[GoogleOAuth Callback Error]:', err.message);
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return NextResponse.redirect(`${protocol}://${host}/auth/login?error=Google_OAuth_Failed`);
  }
}
