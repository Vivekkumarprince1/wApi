import { Request, Response, NextFunction } from 'express';
import { loginWithPassword, sendAuthOtp, verifyAuthOtp } from '../services/auth/auth-flow-service';
import { getAuthCookieOptions } from '../utils/auth-utils';
import { User, Workspace, Permission } from '../models';
import { AuthenticationError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { proxyController } from './proxyController';

async function getUserFromCookie(req: Request): Promise<any> {
  if ((req as any).user) return (req as any).user;
  const token = (req as any).cookies?.auth_token;
  if (!token) return undefined;
  try {
    const { verifyToken } = await import('../utils/auth-utils');
    const decoded = verifyToken(token) as any;
    if (!decoded?.id) return undefined;
    return User.findById(decoded.id).lean();
  } catch {
    return undefined;
  }
}

export const authController = {
  /**
   * User Login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw new BadRequestError("Email and password are required");
      }

      const result = await loginWithPassword(email, password);

      const cookieOptions = getAuthCookieOptions();
      res.cookie('auth_token', result.token, {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        maxAge: cookieOptions.maxAge * 1000,
        path: cookieOptions.path,
      });

      res.json({
        success: true,
        token: result.token,
        user: result.user,
        nextStep: result.nextStep
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Signup — send email OTP (alias for monolithic /api/auth/signup)
   */
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, password } = req.body;
      const result = await sendAuthOtp({
        purpose: 'signup_email',
        identifier: email,
        name,
        password,
        requestIp: req.ip,
        currentUser: (req as any).user
      });
      res.json({ success: true, message: 'OTP sent successfully', ...result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Verify signup OTP and establish session
   */
  async verifySignupOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp } = req.body;
      const result = await verifyAuthOtp({
        purpose: 'signup_email',
        identifier: email,
        otp,
        currentUser: undefined
      });

      if (result.token) {
        const cookieOptions = getAuthCookieOptions();
        res.cookie('auth_token', result.token, {
          httpOnly: cookieOptions.httpOnly,
          secure: cookieOptions.secure,
          sameSite: cookieOptions.sameSite,
          maxAge: cookieOptions.maxAge * 1000,
          path: cookieOptions.path,
        });
      }

      res.json({
        success: true,
        authenticated: true,
        user: result.user,
        nextStep: result.nextStep,
        message: 'OTP verified successfully'
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Send OTP
   */
  async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, password, phone, purpose } = req.body;
      const currentUser = await getUserFromCookie(req);
      const result = await sendAuthOtp({
        purpose: purpose || 'signup_email',
        identifier: email || phone,
        name,
        password,
        requestIp: req.ip,
        currentUser
      });
      res.json({ success: true, message: "OTP sent successfully", ...result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Verify OTP
   */
  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { otp, email, phone, purpose } = req.body;
      const currentUser = await getUserFromCookie(req);
      const result = await verifyAuthOtp({
        purpose: purpose || 'signup_email',
        identifier: email || phone,
        otp,
        currentUser
      });

      if (result.token) {
        const cookieOptions = getAuthCookieOptions();
        res.cookie('auth_token', result.token, {
          httpOnly: cookieOptions.httpOnly,
          secure: cookieOptions.secure,
          sameSite: cookieOptions.sameSite,
          maxAge: cookieOptions.maxAge * 1000,
          path: cookieOptions.path,
        });
      }

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get Current User (Session)
   */
  async me(req: any, res: Response, next: NextFunction) {
    try {
      const { user, workspace, role, permissions, isImpersonating } = req;
      
      if (!user) {
        throw new AuthenticationError("Not authenticated");
      }

      // Refresh cookie with current settings (specifically httpOnly: false for sockets)
      const cookieOptions = getAuthCookieOptions();
      const currentToken = req.cookies.auth_token || req.headers.authorization?.split(' ')[1];
      
      if (currentToken) {
        res.cookie('auth_token', currentToken, {
          httpOnly: cookieOptions.httpOnly,
          secure: cookieOptions.secure,
          sameSite: cookieOptions.sameSite,
          maxAge: cookieOptions.maxAge * 1000,
          path: cookieOptions.path,
        });
      }

      const { getNextOnboardingPath } = await import('../services/onboarding/onboarding-state-service');
      const { getWorkspaceAccessDecision, getWorkspaceBillingStatus, isWorkspaceBillingValid } = await import('../services/workspace-access-service');
      const workspaceToUse = workspace;

      // Self-healing: Trigger background sync if connected but potentially stale
      if (workspaceToUse?.whatsappConnected && workspaceToUse?.bspManaged) {
          const lastSync = workspaceToUse.bspLastSyncedAt ? new Date(workspaceToUse.bspLastSyncedAt).getTime() : 0;
          const now = Date.now();
          if (now - lastSync > 3600000) {
              const { syncAssignedGupshupApp } = await import("../services/bsp/gupshup-app-assignment-service");
              const { Business } = await import("../models");
              const business = await Business.findOne({ workspace: workspaceToUse._id });
              syncAssignedGupshupApp(user, workspaceToUse, business).catch(err => 
                  console.error(`[SessionSync] Failed auto-sync for ${workspaceToUse.name}:`, err.message)
              );
          }
      }

      const stage1Complete = !!(
        workspaceToUse?.bspWabaId &&
        (workspaceToUse?.bspPhoneNumberId || workspaceToUse?.phoneNumberId) &&
        workspaceToUse?.bspPhoneStatus === 'CONNECTED'
      );

      // SINGLE SOURCE OF TRUTH: Fetch wallet data from Billing Microservice
      let walletData = { balance: 0, thresholdAmount: 5, currency: 'INR', isServiceDown: false };
      
      if (workspaceToUse?._id) {
        try {
            const walletResponse = await proxyController.forwardToService('billing', {
                method: 'GET',
                path: `/api/billing/wallets/${workspaceToUse._id}`,
                workspaceId: workspaceToUse._id.toString(),
                userId: user._id.toString(),
                userRole: user.role,
                headers: { 'x-timeout': '3000' } // Hint for shorter timeout if supported
            });
            
            if (walletResponse.status === 200) {
                let remoteWallet = walletResponse.data.wallet || walletResponse.data.data || {};
                
                // Automated Sync Check: If remote has not synced legacy balance yet, trigger it now.
                const localBalancePaise = workspaceToUse?.wallet?.balance ?? workspaceToUse?.walletBalance ?? 0;
                if (!remoteWallet.isLegacySynced && localBalancePaise > 0) {
                    console.log(`[SessionSync] Merging legacy balance for ${workspaceToUse.name}: ${localBalancePaise} paise`);
                    try {
                        const syncRes = await proxyController.forwardToService('billing', {
                            method: 'POST',
                            path: `/api/billing/wallets/${workspaceToUse._id}/sync`,
                            data: { balancePaise: localBalancePaise },
                            workspaceId: workspaceToUse._id.toString(),
                            userId: user._id.toString(),
                            userRole: user.role
                        });
                        if (syncRes.status === 200) {
                            remoteWallet = syncRes.data.wallet || syncRes.data.data || remoteWallet;
                        }
                    } catch (syncErr: any) {
                        console.error(`[SessionSync] Legacy sync failed for ${workspaceToUse.name}:`, syncErr.message);
                    }
                }

                walletData = {
                    balance: (remoteWallet.availableBalance ?? 0) / 100,
                    thresholdAmount: (remoteWallet.thresholdAmount ?? 50000) / 100,
                    currency: remoteWallet.currency ?? 'INR',
                    isServiceDown: false
                };
            }
        } catch (billingErr: any) {
            const isCircuitOpen = billingErr.message === 'CIRCUIT_OPEN';
            console.error(`[SessionWalletFetch] Billing service ${isCircuitOpen ? 'CIRCUIT_OPEN' : 'unreachable'} for ${workspaceToUse._id}:`, billingErr.message);
            walletData = {
              balance: 0,
              thresholdAmount: 5,
              currency: 'INR',
              isServiceDown: true
            };
        }
      }

      const isWorkspaceOwner = role === 'owner';
      let accessDecision;

      if (!isWorkspaceOwner && role) {
        const billingStatus = getWorkspaceBillingStatus(workspaceToUse);
        const isBillingValid = isWorkspaceBillingValid(workspaceToUse);
        accessDecision = {
          accessRestriction: isBillingValid ? null : {
            kind: 'billing' as const,
            title: 'No valid plan',
            description: `This workspace does not have an active plan.`,
            targetPath: '/dashboard/billing',
            actionLabel: 'View Billing'
          },
          nextStep: null,
          billingStatus,
          isBillingValid
        };
      } else {
        accessDecision = await getWorkspaceAccessDecision(user, workspaceToUse);
      }

      res.json({
        success: true,
        authenticated: true,
        permissions: permissions || null,
        user: {
          id: user._id,
          name: user.name,
          email: user.email || null,
          phone: user.phone || null,
          role: user.role,
          team: user.team,
          emailVerified: !!user.emailVerified,
          phoneVerified: !!user.phoneVerified,
          authProvider: user.authProvider || 'local',
          accountStatus: user.accountStatus || 'AWAITING_EMAIL_VERIFICATION',
          createdAt: user.createdAt
        },
        workspace: workspaceToUse ? {
          id: workspaceToUse._id,
          name: workspaceToUse.name,
          plan: workspaceToUse.plan || 'free',
          billingStatus: workspaceToUse.billingStatus || 'trialing',
          whatsappConnected: workspaceToUse.whatsappConnected || stage1Complete,
          onboarding: workspaceToUse.onboarding,
          stage1: { 
            complete: stage1Complete,
            phoneStatus: workspaceToUse.bspPhoneStatus || (workspaceToUse.whatsappConnected ? 'CONNECTED' : 'NOT_CONNECTED')
          }, 
          address: workspaceToUse.address,
          city: workspaceToUse.city,
          state: workspaceToUse.state,
          country: workspaceToUse.country,
          zipCode: workspaceToUse.zipCode,
          industry: workspaceToUse.industry,
          website: workspaceToUse.website,
          wallet: walletData,
          role: role || null
        } : null,
        phone: {
          number: user.phone,
          verified: !!user.phoneVerified
        },
        nextStep: accessDecision.nextStep,
        accessRestriction: accessDecision.accessRestriction,
        isImpersonating: !!isImpersonating
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Google Auth Callback
   */
   async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = { ...req.query, ...req.body } as any;
      if (!code) throw new BadRequestError("Code is required");

      const { getGoogleUser } = await import('../services/auth/google-auth-service');
      const googleUser = await getGoogleUser(code);

      if (!googleUser?.email) {
        throw new BadRequestError("Failed to get user info from Google");
      }

      const { User, Workspace, Permission } = await import('../models');
      const { signToken } = await import('../utils/auth-utils');

      let user: any = await User.findOne({ 
        $or: [
          { googleId: googleUser.id }, 
          { email: googleUser.email.toLowerCase() }
        ] 
      });

      if (!user) {
        const name = googleUser.name || googleUser.email.split('@')[0];
        const workspace = await Workspace.create({ 
          name: `${name}'s workspace`,
          onboarding: { step: 'industry_selection', completed: false }
        });

        user = await User.create({
          name,
          email: googleUser.email.toLowerCase(),
          googleId: googleUser.id,
          workspace: workspace._id,
          activeWorkspace: workspace._id,
          role: 'owner',
          emailVerified: true,
          accountStatus: 'SIGNUP_COMPLETED',
          authProvider: 'google',
          profilePicture: googleUser.picture
        });

        workspace.owner = user._id;
        await workspace.save();
        
        const { Permission: PermissionModel } = await import('../models/auth/Permission');
        if ((PermissionModel as any).seedOwnerPermissions) {
           await (PermissionModel as any).seedOwnerPermissions(workspace._id, user._id);
        }
      } else {
        let needsSave = false;
        if (!user.googleId) {
          user.googleId = googleUser.id;
          user.authProvider = 'google';
          needsSave = true;
        }
        if (!user.emailVerified) {
          user.emailVerified = true;
          needsSave = true;
        }
        if (needsSave) await user.save();
      }

      const token = signToken({ id: user._id.toString() });

      const cookieOptions = getAuthCookieOptions();
      res.cookie('auth_token', token, {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        maxAge: cookieOptions.maxAge * 1000,
        path: cookieOptions.path,
      });

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Password Reset Request
   */
  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError('Email is required');

      const { User } = await import('../models');
      const { MailService } = await import('../services/shared/mail-service');
      const jwt = await import('jsonwebtoken');
      const { config } = await import('../config');

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return res.json({ success: true, message: 'Instructions sent if email exists' });
      }

      const resetToken = jwt.sign(
        { id: user._id, purpose: 'password_reset' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const resetUrl = `${config.baseUrl}/auth/reset?token=${resetToken}`;

      await MailService.sendMail({
        to: user.email!,
        subject: 'Reset your wApi password',
        html: `<p>Hello ${user.name},</p><p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`
      });

      res.json({ success: true, message: 'Instructions sent if email exists' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Reset Password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      if (!token || !password) throw new BadRequestError('Token and password are required');

      const { User } = await import('../models');
      const jwt = await import('jsonwebtoken');
      const bcrypt = await import('bcryptjs');
      const { config } = await import('../config');

      let decoded: any;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch (err) {
        throw new BadRequestError('Invalid or expired token');
      }

      const user = await User.findById(decoded.id);
      if (!user) throw new NotFoundError('User not found');

      user.passwordHash = await bcrypt.default.hash(password, 10);
      await user.save();

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Logout
   */
  async logout(req: Request, res: Response) {
    res.clearCookie('auth_token', { path: '/' });
    res.json({ success: true, message: "Logged out successfully" });
  },

  /**
   * Switch Workspace
   */
  async switchWorkspace(req: any, res: Response, next: NextFunction) {
    try {
      const { workspaceId } = req.body;
      const { Permission, User } = await import('../models');

      const membership = await Permission.findOne({ workspace: workspaceId, user: req.user._id });
      if (!membership) throw new ForbiddenError("Access denied to this workspace");

      await User.findByIdAndUpdate(req.user._id, { activeWorkspace: workspaceId });
      res.json({ success: true, message: "Workspace switched" });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update Profile
   */
  async updateMe(req: any, res: Response, next: NextFunction) {
    try {
      const { name, phone, timezone } = req.body;
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { name, phone, timezone } },
        { new: true }
      ).select('-passwordHash');
      
      res.json({ success: true, user: updatedUser });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Google OAuth URL
   */
  async googleUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3005/api/v1/auth/google/callback';
      
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email'
      }).toString()}`;

      res.json({ success: true, url });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Facebook Login
   */
  async facebookLogin(req: Request, res: Response, next: NextFunction) {
    try {
      // This would integrate with Facebook SDK
      // For now, returning placeholder
      throw new BadRequestError("Facebook authentication not yet implemented");
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get Invitation by Token
   */
  async getInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { WorkspaceInvitation } = await import('../models');
      
      const invitation = await WorkspaceInvitation.findOne({ token, isAccepted: false })
        .populate('workspace', 'name')
        .populate('invitedBy', 'name email');
      
      if (!invitation || invitation.expiresAt < new Date()) {
        throw new NotFoundError("Invitation expired or invalid");
      }
      
      res.json({
        success: true,
        invitation: {
          _id: invitation._id,
          email: invitation.email,
          workspace: invitation.workspace,
          invitedBy: invitation.invitedBy,
          role: invitation.role
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Accept Workspace Invitation
   */
  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password, name } = req.body;
      const { WorkspaceInvitation, User, Permission } = await import('../models');
      
      const invitation = await WorkspaceInvitation.findOne({ token, isAccepted: false });
      if (!invitation || invitation.expiresAt < new Date()) {
        throw new NotFoundError("Invitation expired");
      }
      
      // Create or find user
      let user = await User.findOne({ email: invitation.email });
      if (!user) {
        user = await User.create({
          name: name || invitation.email.split('@')[0],
          email: invitation.email,
          passwordHash: password ? require('bcryptjs').hashSync(password, 10) : undefined,
          status: 'active'
        });
      }
      
      // Add permission
      await Permission.create({
        workspace: invitation.workspace,
        user: user._id,
        role: invitation.role,
        isActive: true
      });
      
      // Mark invitation as accepted
      invitation.status = 'accepted';
      invitation.joinedAt = new Date();
      await invitation.save();
      
      res.json({
        success: true,
        message: "Invitation accepted",
        user,
        workspace: invitation.workspace
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * List Workspaces for Current User
   */
  async listWorkspaces(req: any, res: Response, next: NextFunction) {
    try {
      const { Permission, Workspace } = await import('../models');
      
      const permissions = await Permission.find({ 
        user: req.user._id,
        isActive: true 
      }).populate('workspace').sort({ createdAt: -1 });
      
      const workspaces = permissions
        .filter(p => p.workspace)
        .map(p => ({
          _id: (p.workspace as any)._id,
          name: (p.workspace as any).name,
          avatar: (p.workspace as any).avatar,
          role: p.role,
          isActive: (p.workspace as any)._id?.toString() === req.user.activeWorkspace?.toString()
        }));
      
      res.json({ success: true, workspaces });
    } catch (err) {
      next(err);
    }
  },

  /**
   * List Pending Invitations for Current User
   */
  async listPendingInvitations(req: any, res: Response, next: NextFunction) {
    try {
      const { WorkspaceInvitation } = await import('../models');
      
      const invitations = await WorkspaceInvitation.find({
        email: req.user.email,
        isAccepted: false,
        expiresAt: { $gt: new Date() }
      }).populate('workspace', 'name').populate('invitedBy', 'name email');
      
      res.json({ success: true, invitations });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get Account Overview (GET /api/v1/auth/account)
   */
  async getAccount(req: any, res: Response, next: NextFunction) {
    try {
      const { user, workspace } = req;
      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          accountStatus: user.accountStatus,
          createdAt: user.createdAt
        },
        workspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          plan: workspace.planId || 'free',
          role: req.role
        } : null
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Permanent Account Deletion (DELETE /api/v1/auth/account)
   */
  async deleteAccount(req: any, res: Response, next: NextFunction) {
    try {
      const { confirmText } = req.body;
      if (confirmText !== 'DELETE') {
        throw new BadRequestError("Please type 'DELETE' to confirm");
      }

      const { AccountDeletionService } = await import('../services/auth/account-deletion-service');
      await AccountDeletionService.deleteAccount(req.user._id);

      res.clearCookie('auth_token', getAuthCookieOptions());
      res.json({
        success: true,
        message: "Your account and all associated data have been permanently deleted."
      });
    } catch (err) {
      next(err);
    }
  }
};
