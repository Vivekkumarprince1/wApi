import bcrypt from 'bcryptjs';
import { User, Workspace, Permission, Plan } from '../models/index.js';

export function normalizeEmail(email?: string) {
  return String(email || '').trim().toLowerCase();
}

export function normalizePhone(phone?: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function maskIdentifier(identifier: string) {
  if (identifier.includes('@')) {
    const [name, domain] = identifier.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return identifier.length <= 4 ? identifier : `${identifier.slice(0, 3)}******${identifier.slice(-2)}`;
}

export function getAccountStatusForUser(user: any) {
  if (user.authProvider === 'google') {
    return 'SIGNUP_COMPLETED';
  }
  if (user.email && user.authProvider !== 'google' && !user.emailVerified) {
    return 'AWAITING_EMAIL_VERIFICATION';
  }
  // If already marked SIGNUP_COMPLETED, keep it
  if (user.accountStatus === 'SIGNUP_COMPLETED') {
    return 'SIGNUP_COMPLETED';
  }
  return 'AWAITING_BUSINESS_INFO';
}

export async function createOwnerAccount(input: {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  passwordHash?: string;
  googleId?: string;
  profilePicture?: string;
  authProvider: 'local' | 'google' | 'phone' | 'mixed';
  emailVerified?: boolean;
  phoneVerified?: boolean;
}) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const passwordHash = input.passwordHash || (input.password ? await bcrypt.hash(input.password, 12) : undefined);
  const displayName =
    input.name ||
    (email ? email.split('@')[0] : '') ||
    (phone ? `User ${phone.slice(-4)}` : 'New User');

  const defaultPlan: any = await Plan.findOne({ code: 'free' }).catch(() => null);

  const workspace = await Workspace.create({
    name: `${displayName}'s workspace`,
    plan: defaultPlan?._id,
    businessVerification: { status: 'not_submitted', isTestMode: false }
  });

  const user = await User.create({
    name: displayName,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    passwordHash,
    googleId: input.googleId,
    profilePicture: input.profilePicture,
    authProvider: input.authProvider,
    emailVerified: !!input.emailVerified,
    phoneVerified: !!input.phoneVerified,
    workspace: workspace._id,
    activeWorkspace: workspace._id,
    role: 'owner',
    status: 'active'
  });

  user.accountStatus = getAccountStatusForUser(user);
  await user.save();

  workspace.owner = user._id;
  await workspace.save();

  await (Permission as any).seedOwnerPermissions(workspace._id, user._id);

  return { user, workspace };
}

export async function touchLogin(user: any) {
  user.lastLoginAt = new Date();
  user.accountStatus = getAccountStatusForUser(user);
  await user.save();
  const workspace = user.workspace?._id
    ? user.workspace
    : await Workspace.findById(user.activeWorkspace || user.workspace);
  return { user, workspace };
}
