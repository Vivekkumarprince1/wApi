const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Permission = require('../models/Permission');
const { jwtSecret, googleClientId, facebookAppId, facebookAppSecret } = require('../config');
const { googleClientSecret } = require('../config');
const { getRedis, setJson, getJson, deleteKey } = require('../config/redis');

const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// OTP + verification state must survive restarts and multi-instance deployments (Meta/Interakt requirement)
const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const EMAIL_VERIFY_TTL_SECONDS = 30 * 60; // 30 minutes
const PASSWORD_RESET_TTL_SECONDS = 30 * 60; // 30 minutes

function getRedisClient() {
  // Fail fast if Redis is unavailable to avoid silent OTP/state loss
  return getRedis();
}

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send OTP for signup
async function sendSignupOTP(req, res, next) {
  try {
    const { email } = req.body;
    getRedisClient(); // Ensure Redis is available (required for durable OTP)
    
    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    const otp = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_SECONDS * 1000;
    await setJson(`otp:signup:${email}`, {
      otp,
      email,
      expiresAt
    }, OTP_EXPIRY_SECONDS);
    
    console.log(`Signup OTP for ${email}: ${otp}`);
    
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    next(err);
  }
}

// Verify OTP and complete signup
async function verifySignupOTP(req, res, next) {
  try {
    const { email, otp, name, password } = req.body;
    getRedisClient(); // Ensure Redis is available (required for durable OTP)
    
    const stored = await getJson(`otp:signup:${email}`);
    if (!stored) {
      return res.status(400).json({ message: 'OTP not found or expired' });
    }
    
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      await deleteKey(`otp:signup:${email}`);
      return res.status(400).json({ message: 'OTP expired' });
    }
    
    if (stored.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    // OTP verified, create user
    await deleteKey(`otp:signup:${email}`);
    
      const workspace = await Workspace.create({
        name: `${name}'s workspace`,
        onboarding: {
          step: 'business-info',
          status: 'not-started',
          businessInfoCompleted: false,
          whatsappSetupCompleted: false,
          templateSetupCompleted: false,
          completedAt: null
        }
      });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      name, 
      email, 
      passwordHash, 
      workspace: workspace._id, 
      role: 'owner',
      emailVerified: true
    });

      await Permission.seedOwnerPermissions(workspace._id, user._id);
    
    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}

// Send OTP for login
async function sendLoginOTP(req, res, next) {
  try {
    const { email } = req.body;
    getRedisClient(); // Ensure Redis is available (required for durable OTP)
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const otp = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_SECONDS * 1000;
    await setJson(`otp:login:${email}`, {
      otp,
      email,
      expiresAt
    }, OTP_EXPIRY_SECONDS);
    
    console.log(`Login OTP for ${email}: ${otp}`);
    
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    next(err);
  }
}

// Verify OTP and complete login
async function verifyLoginOTP(req, res, next) {
  try {
    const { email, otp } = req.body;
    getRedisClient(); // Ensure Redis is available (required for durable OTP)
    
    const stored = await getJson(`otp:login:${email}`);
    if (!stored) {
      return res.status(400).json({ message: 'OTP not found or expired' });
    }
    
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      await deleteKey(`otp:login:${email}`);
      return res.status(400).json({ message: 'OTP expired' });
    }
    
    if (stored.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    // OTP verified, log in user
    await deleteKey(`otp:login:${email}`);
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}

// Signup with email/password (creates workspace)
async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    const workspace = await Workspace.create({
      name: `${name}'s workspace`,
      onboarding: {
        step: 'business-info',
        status: 'not-started',
        businessInfoCompleted: false,
        whatsappSetupCompleted: false,
        templateSetupCompleted: false,
        completedAt: null
      }
    });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, workspace: workspace._id, role: 'owner' });
    await Permission.seedOwnerPermissions(workspace._id, user._id);
    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}

// Login with email/password
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}

// Get current authenticated user
async function me(req, res, next) {
  try {
    // User is already attached by auth middleware
    const user = await User.findById(req.user._id)
      .select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch workspace with full details
    const workspace = await Workspace.findById(user.workspace);
    
    // Prepare comprehensive response
    const response = {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified || false,
        createdAt: user.createdAt
      },
      workspace: workspace ? {
        _id: workspace._id,
        name: workspace.name,
        plan: workspace.plan || 'free',
        planLimits: workspace.planLimits,
        usage: workspace.usage,
        // Subscription details
        subscription: {
          status: workspace.subscription?.status || 'active',
          startDate: workspace.subscription?.startDate,
          endDate: workspace.subscription?.endDate,
          autoRenew: workspace.subscription?.autoRenew
        },
        // WhatsApp connection status
        whatsapp: {
          isConnected: workspace.isBspConnected?.() || (!!(workspace.whatsappPhoneNumberId && !workspace.bspManaged)),
          phoneNumber: workspace.whatsappPhoneNumber || null,
          phoneNumberId: workspace.whatsappPhoneNumberId,
          wabaId: workspace.wabaId,
          businessAccountId: workspace.businessAccountId,
          connectedAt: workspace.connectedAt,
          // Include setup status if not yet connected
          setupStatus: workspace.whatsappSetup?.status || 'not_started',
          requestedNumber: workspace.whatsappSetup?.requestedNumber
        },
        // Instagram connection status
        instagram: {
          isConnected: workspace.instagramConfig?.isConnected || false,
          accountId: workspace.instagramConfig?.accountId
        },
        // Business verification status
        verification: {
          status: workspace.businessVerification?.status || 'not_submitted',
          isVerified: workspace.businessVerification?.status === 'verified',
          submittedAt: workspace.businessVerification?.submittedAt,
          verifiedAt: workspace.businessVerification?.verifiedAt
        },
        // Business documents
        documents: {
          gstNumber: workspace.businessDocuments?.gstNumber,
          msmeNumber: workspace.businessDocuments?.msmeNumber,
          panNumber: workspace.businessDocuments?.panNumber,
          hasDocuments: !!(workspace.businessDocuments?.gstNumber || workspace.businessDocuments?.msmeNumber || workspace.businessDocuments?.panNumber)
        },
        // Business info
        businessInfo: {
          name: workspace.name,
          industry: workspace.industry,
          website: workspace.website,
          address: workspace.address,
          city: workspace.city,
          state: workspace.state,
          country: workspace.country
        },
        createdAt: workspace.createdAt
      } : null
    };
    
    res.json(response);
  } catch (err) {
    next(err);
  }
}

// Logout user
async function logout(req, res, next) {
  try {
    // In a JWT-based system, logout is typically handled client-side
    // But we can add server-side logic here if needed (e.g., token blacklisting)
    res.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (err) {
    next(err);
  }
}

// Update user profile
async function updateProfile(req, res, next) {
  try {
    const { name, email, phone, company } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }
    
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (company !== undefined) user.company = company;
    
    await user.save();
    
    // Return user without password hash
    const updatedUser = await User.findById(user._id)
      .select('-passwordHash')
      .populate('workspace');
    
    res.json({ 
      success: true,
      user: updatedUser 
    });
  } catch (err) {
    next(err);
  }
}

// Send email verification OTP
async function sendEmailVerification(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    getRedisClient(); // Ensure Redis is available (Meta/Interakt requirement)
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    // Token-based verification (more secure than OTP, required for production)
    const token = generateSecureToken();
    const expiresAt = Date.now() + EMAIL_VERIFY_TTL_SECONDS * 1000;
    await setJson(`email-verify:${user._id}`, {
      token,
      email: user.email,
      expiresAt
    }, EMAIL_VERIFY_TTL_SECONDS);
    
    console.log(`Email verification token for ${user.email}: ${token}`);
    
    res.json({ 
      success: true,
      message: 'Verification code sent to your email' 
    });
  } catch (err) {
    next(err);
  }
}

// Verify email with OTP
async function verifyEmail(req, res, next) {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);
    getRedisClient(); // Ensure Redis is available (Meta/Interakt requirement)
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const stored = await getJson(`email-verify:${user._id}`);
    if (!stored) {
      return res.status(400).json({ message: 'OTP not found or expired' });
    }
    
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      await deleteKey(`email-verify:${user._id}`);
      return res.status(400).json({ message: 'OTP expired' });
    }
    
    // NOTE: For backward compatibility, field name remains 'otp' but is a secure token.
    if (stored.token !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    // OTP verified, mark email as verified
    await deleteKey(`email-verify:${user._id}`);
    user.emailVerified = true;
    await user.save();
    
    res.json({ 
      success: true,
      message: 'Email verified successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    next(err);
  }
}

// Request password reset (token-based, expiring)
async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    getRedisClient(); // Required for secure, expiring reset tokens

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    // Prevent user enumeration: always return success
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a reset link has been sent'
      });
    }

    const token = generateSecureToken();
    const expiresAt = Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000;
    await setJson(`pwd-reset:${token}`, {
      userId: user._id.toString(),
      email: user.email,
      expiresAt
    }, PASSWORD_RESET_TTL_SECONDS);

    console.log(`Password reset token for ${user.email}: ${token}`);

    res.json({
      success: true,
      message: 'If an account exists, a reset link has been sent'
    });
  } catch (err) {
    next(err);
  }
}

// Complete password reset using token
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    getRedisClient(); // Required for secure, expiring reset tokens

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const stored = await getJson(`pwd-reset:${token}`);
    if (!stored) {
      return res.status(400).json({ message: 'Reset token not found or expired' });
    }

    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      await deleteKey(`pwd-reset:${token}`);
      return res.status(400).json({ message: 'Reset token expired' });
    }

    const user = await User.findById(stored.userId);
    if (!user) {
      await deleteKey(`pwd-reset:${token}`);
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    await deleteKey(`pwd-reset:${token}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (err) {
    next(err);
  }
}

// Return Google OAuth authorization URL (server-side redirect flow)
async function getGoogleAuthUrl(req, res, next) {
  try {
    if (!googleClientId) {
      return res.status(500).json({ message: 'Google client ID not configured' });
    }

    // Build redirect URI from request host to avoid mismatches (works with dev ports/ngrok)
    const host = req.get('host');
    const protocol = req.protocol || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const redirectUri = `${protocol}://${host}/api/v1/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account'
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

// Debug endpoint to help register OAuth settings in Google Cloud Console
async function getGoogleDebug(req, res, next) {
  try {
    const host = req.get('host');
    const protocol = req.protocol || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const redirectUri = `${protocol}://${host}/api/v1/auth/google/callback`;
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    const jsOrigin = frontend; // recommended JS origin to register

    res.json({
      googleClientId: googleClientId || null,
      recommendedRedirectUri: redirectUri,
      recommendedJsOrigin: jsOrigin,
      serverHost: host,
      frontend
    });
  } catch (err) {
    next(err);
  }
}

// OAuth callback handler for server-side Google auth flow
async function googleOAuthCallback(req, res, next) {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');

    if (!googleClientId || !googleClientSecret) {
      return res.status(500).send('Google OAuth not configured on server');
    }

    // Prefer host-based redirect to match what Google will call back to
    const host = req.get('host');
    const protocol = req.protocol || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const redirectUri = `${protocol}://${host}/api/v1/auth/google/callback`;

    // Exchange code for tokens
    const tokenResp = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }
    });

    const idToken = tokenResp.data.id_token;
    if (!idToken) return res.status(400).send('No id_token returned');

    // Verify ID token (reuse existing logic)
    let payload = null;
    if (googleClient) {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientId });
      payload = ticket.getPayload();
    } else {
      // Fallback verify via tokeninfo (development)
      const info = await axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { id_token: idToken } });
      payload = info.data;
    }

    const googleId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name || email?.split('@')[0] || 'Google User';

    if (!email || !googleId) return res.status(400).send('Invalid token payload');

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      const workspace = await Workspace.create({ name: `${name}'s workspace` });
      user = await User.create({ name, email, googleId, workspace: workspace._id, role: 'owner' });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const authToken = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });

    // Redirect back to frontend with token in query (frontend should capture it)
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Log the redirect URI used (helpful for diagnosing redirect_uri_mismatch)
    console.log('[GoogleOAuth] Used redirect URI:', redirectUri);
    return res.redirect(`${frontend}/auth/google/callback?token=${encodeURIComponent(authToken)}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err.response?.data || err.message);
    return res.status(500).send('Google OAuth callback failed');
  }
}

async function googleOAuthLogin(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }
    let payload = null;

    // Preferred: verify using google-auth-library with configured client ID
    if (googleClient) {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } else {
      // Fallback for development: use Google's tokeninfo endpoint if GOOGLE_CLIENT_ID is not set
      // This allows local testing when env isn't configured. DO NOT rely on this in production.
      if (process.env.NODE_ENV === 'development') {
        try {
          const axios = require('axios');
          const resp = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
            params: { id_token: token }
          });
          payload = resp.data;
          console.warn('⚠️ GOOGLE_CLIENT_ID not configured; using tokeninfo fallback (development only)');
        } catch (fallbackErr) {
          console.error('Google token verification fallback failed:', fallbackErr.message || fallbackErr);
          return res.status(400).json({ message: 'Invalid Google token' });
        }
      } else {
        return res.status(500).json({ message: 'Google client not configured' });
      }
    }

    // Validate basic payload
    const googleId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name || email?.split('@')[0] || 'Google User';

    if (!email || !googleId) {
      return res.status(400).json({ message: 'Invalid Google token payload' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      const workspace = await Workspace.create({ name: `${name}'s workspace` });
      user = await User.create({
        name,
        email,
        googleId,
        workspace: workspace._id,
        role: 'owner',
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const authToken = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });
    res.json({ token: authToken, user });
  } catch (err) {
    next(err);
  }
}

async function facebookOAuthLogin(req, res, next) {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ message: 'Facebook access token is required' });
    }
    if (!facebookAppId || !facebookAppSecret) {
      return res.status(500).json({ message: 'Facebook app credentials missing' });
    }

    await axios.get('https://graph.facebook.com/debug_token', {
      params: {
        input_token: accessToken,
        access_token: `${facebookAppId}|${facebookAppSecret}`,
      },
    });

    const { data: profile } = await axios.get('https://graph.facebook.com/me', {
      params: {
        fields: 'id,name,email',
        access_token: accessToken,
      },
    });

    const facebookId = profile?.id;
    const email = profile?.email;
    const name = profile?.name || email?.split('@')[0] || 'Facebook User';

    if (!facebookId) {
      return res.status(400).json({ message: 'Invalid Facebook token' });
    }

    let user = await User.findOne({
      $or: [{ facebookId }, ...(email ? [{ email }] : [])],
    });

    if (!user) {
      const workspace = await Workspace.create({ name: `${name}'s workspace` });
      user = await User.create({
        name,
        email: email || `${facebookId}@facebook.com`,
        facebookId,
        role: 'owner',
        workspace: workspace._id,
      });
    } else if (!user.facebookId) {
      user.facebookId = facebookId;
      if (!user.email && email) {
        user.email = email;
      }
      await user.save();
    }

    const authToken = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });
    res.json({ token: authToken, user });
  } catch (err) {
    next(err);
  }
}

module.exports = { 
  signup, 
  login, 
  me, 
  logout,
  updateProfile,
  sendSignupOTP, 
  verifySignupOTP, 
  sendLoginOTP, 
  verifyLoginOTP,
  googleOAuthLogin,
  // New helper endpoints
  getGoogleAuthUrl,
  getGoogleDebug,
  googleOAuthCallback,
  facebookOAuthLogin,
  sendEmailVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword
};
