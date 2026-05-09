import bcrypt from 'bcryptjs';
import { User, Workspace } from '@/models';
import { signToken } from '@/utils/auth-utils';
import { createAndSendOtp, verifyOtp } from './otp-service';
import {
  createOwnerAccount,
  getAccountStatusForUser,
  normalizeEmail,
  normalizePhone,
  touchLogin
} from './account-service';
import { getNextOnboardingPath, syncOnboardingState } from '@/services/onboarding/onboarding-state-service';
import type { OtpPurpose } from '@/models';

export async function sendAuthOtp(input: {
  purpose: OtpPurpose;
  identifier?: string;
  name?: string;
  password?: string;
  requestIp?: string;
  currentUser?: any;
}) {
  const purpose = input.purpose;
  let identifier = input.identifier || '';
  let metadata: Record<string, unknown> = {};

  if (purpose === 'signup_email') {
    const email = normalizeEmail(identifier);
    if (!email || !input.name || !input.password) {
      throw Object.assign(new Error('Name, email and password are required'), { status: 400 });
    }
    const existing = await User.findOne({ email });
    if (existing) throw Object.assign(new Error('Email already registered'), { status: 400, code: 'EMAIL_EXISTS' });
    metadata = {
      name: input.name,
      email,
      passwordHash: await bcrypt.hash(input.password, 12)
    };
    identifier = email;
  }

  if (purpose === 'email_login') {
    const email = normalizeEmail(identifier);
    if (!email) throw Object.assign(new Error('Email is required'), { status: 400 });
    const existing = await User.findOne({ email });
    if (!existing) throw Object.assign(new Error('User not found'), { status: 404 });
    identifier = email;
  }

  if (purpose === 'email_verification') {
    if (!input.currentUser?.email) throw Object.assign(new Error('Authenticated email is required'), { status: 401 });
    identifier = input.currentUser.email;
  }

  if (purpose === 'phone_verification') {
    identifier = normalizePhone(identifier || input.currentUser?.phone);
    if (!input.currentUser?._id) throw Object.assign(new Error('Authentication required'), { status: 401 });
  }

  if (purpose === 'phone_login') {
    identifier = normalizePhone(identifier);
  }

  if (input.requestIp) {
    metadata.requestIp = input.requestIp;
  }

  return createAndSendOtp({ identifier, purpose, metadata });
}

function publicUser(user: any) {
  return {
    id: user._id,
    name: user.name,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    emailVerified: !!user.emailVerified,
    phoneVerified: !!user.phoneVerified,
    authProvider: user.authProvider
  };
}

export async function loginWithPassword(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (!email || !password) {
    throw Object.assign(new Error('Email and password are required'), { status: 400 });
  }

  const user = await User.findOne({ email });
  if (!user || !user.passwordHash) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const { workspace } = await touchLogin(user);
  const nextStep = await getNextOnboardingPath(user, workspace);
  const token = signToken({ id: user._id.toString() });

  return {
    token,
    authenticated: true,
    user: publicUser(user),
    nextStep
  };
}

export async function verifyAuthOtp(input: {
  purpose: OtpPurpose;
  identifier?: string;
  otp: string;
  currentUser?: any;
}) {
  const purpose = input.purpose;
  let identifier = input.identifier || '';

  if (purpose === 'email_verification') {
    identifier = input.currentUser?.email || identifier;
  }
  if (purpose === 'phone_verification') {
    identifier = normalizePhone(identifier || input.currentUser?.phone);
  }

  const challenge = await verifyOtp({ identifier, purpose, otp: input.otp });
  let user: any = input.currentUser || null;
  let workspace: any = null;

  if (purpose === 'signup_email') {
    const metadata = challenge.metadata as any;
    const created = await createOwnerAccount({
      name: metadata?.name,
      email: metadata?.email || challenge.identifier,
      passwordHash: metadata?.passwordHash,
      authProvider: 'local',
      emailVerified: true,
      phoneVerified: false
    });
    user = created.user;
    workspace = created.workspace;
  }

  if (purpose === 'email_login') {
    user = await User.findOne({ email: challenge.identifier });
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
    user.emailVerified = true;
    user.accountStatus = getAccountStatusForUser(user);
    const touched = await touchLogin(user);
    workspace = touched.workspace;
  }

  if (purpose === 'phone_login') {
    const phone = normalizePhone(challenge.identifier);
    user = await User.findOne({ phone });
    if (!user) {
      const created = await createOwnerAccount({
        phone,
        authProvider: 'phone',
        phoneVerified: true,
        emailVerified: false
      });
      user = created.user;
      workspace = created.workspace;
    } else {
      user.phone = phone;
      user.phoneVerified = true;
      if (!user.authProvider) user.authProvider = user.email ? 'mixed' : 'phone';
      user.accountStatus = getAccountStatusForUser(user);
      const touched = await touchLogin(user);
      workspace = touched.workspace;
    }
  }

  if (purpose === 'email_verification') {
    if (!user) throw Object.assign(new Error('Authentication required'), { status: 401 });
    user.emailVerified = true;
    user.accountStatus = getAccountStatusForUser(user);
    await user.save();
    workspace = await Workspace.findById(user.workspace);
    if (workspace) await syncOnboardingState(user, workspace);
  }

  if (purpose === 'phone_verification') {
    if (!user) throw Object.assign(new Error('Authentication required'), { status: 401 });
    user.phone = normalizePhone(challenge.identifier);
    user.phoneVerified = true;
    user.accountStatus = getAccountStatusForUser(user);
    await user.save();
    workspace = await Workspace.findById(user.workspace);
    if (workspace) await syncOnboardingState(user, workspace);
  }

  if (!user) throw Object.assign(new Error('Unable to resolve user'), { status: 400 });
  if (!workspace) workspace = await Workspace.findById(user.workspace);

  const nextStep = await getNextOnboardingPath(user, workspace);
  const token = signToken({ id: user._id.toString() });

  return {
    token,
    authenticated: true,
    user: publicUser(user),
    nextStep
  };
}
