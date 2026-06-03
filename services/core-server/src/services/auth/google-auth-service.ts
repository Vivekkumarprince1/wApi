import { google } from 'googleapis';

/**
 * Google OAuth Configuration
 */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/auth/google/callback`
);

if (!process.env.GOOGLE_CLIENT_ID) {
    console.error("\x1b[31m[Google Auth] Error: GOOGLE_CLIENT_ID is missing from environment variables!\x1b[0m");
}

/**
 * Generate Google Auth URL
 */
export const getGoogleAuthUrl = (type: string = 'login') => {
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: type,
        prompt: 'consent'
    });

    console.log(`[Google Auth] Generated URL for type ${type}:`, url.substring(0, 50) + "...");
    return url;
};

/**
 * Get Google User from Code
 */
export const getGoogleUser = async (code: string) => {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    return {
        email: data.email,
        name: data.name,
        picture: data.picture,
        id: data.id,
        tokens
    };
};
