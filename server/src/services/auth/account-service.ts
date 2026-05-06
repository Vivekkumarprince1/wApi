import bcrypt from 'bcryptjs';
import { Permission, User, Workspace, Plan } from '@/models';
import { syncOnboardingState } from '@/services/onboarding/onboarding-state-service';

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
  if (user.email && user.authProvider !== 'google' && !user.emailVerified) {
    return 'AWAITING_EMAIL_VERIFICATION';
  }
  if (!user.phoneVerified) return 'AWAITING_MOBILE_VERIFICATION';
  return 'AWAITING_BUSINESS_INFO';
}

export async function createOwnerAccount(input: {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  passwordHash?: string;
  googleId?: string;
  authProvider: 'local' | 'google' | 'phone' | 'mixed';
  emailVerified?: boolean;
  phoneVerified?: boolean;
}) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const passwordHash = input.passwordHash || (input.password ? await bcrypt.hash(input.password, 10) : undefined);
  const displayName =
    input.name ||
    (email ? email.split('@')[0] : '') ||
    (phone ? `User ${phone.slice(-4)}` : 'New User');

  // Resolve Default Plan dynamically
  const defaultPlan = await Plan.findOne({ isDefault: true, isActive: true }) || await Plan.findOne({ isActive: true });

  const workspace = await Workspace.create({
    name: `${displayName}'s workspace`,
    plan: defaultPlan?._id,
    planId: defaultPlan?.slug || 'free',
    planLimits: defaultPlan?.limits ? {
      maxContacts: defaultPlan.limits.maxContacts || 1000,
      maxMessages: defaultPlan.limits.maxMessagesPerMonth || 5000,
      maxAutomations: defaultPlan.limits.maxAutomations || 2,
      maxTemplates: defaultPlan.limits.maxTemplates || 10,
      maxCampaigns: 50, // Default static for now
      maxActiveDeals: 50,
      maxPipelines: 3
    } : undefined,
    onboarding: {
      step: 'business-info',
      status: 'not-started',
      businessInfoCompleted: false,
      whatsappSetupCompleted: false,
      completed: false
    },
    businessVerification: { status: 'not_submitted', isTestMode: false },
    esbFlow: { status: 'not_started' }
  });

  const user = await User.create({
    name: displayName,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    passwordHash,
    googleId: input.googleId,
    authProvider: input.authProvider,
    emailVerified: !!input.emailVerified,
    phoneVerified: !!input.phoneVerified,
    workspace: workspace._id,
    role: 'owner',
    status: 'active'
  });

  user.accountStatus = getAccountStatusForUser(user);
  await user.save();

  workspace.owner = user._id;
  await workspace.save();
  await (Permission as any).seedOwnerPermissions(workspace._id, user._id);
  await syncOnboardingState(user, workspace);

  return { user, workspace };
}

export async function touchLogin(user: any) {
  user.lastLoginAt = new Date();
  user.accountStatus = getAccountStatusForUser(user);
  await user.save();
  const workspace = user.workspace?._id ? user.workspace : await Workspace.findById(user.workspace);
  if (workspace) await syncOnboardingState(user, workspace);
  return { user, workspace };
}
