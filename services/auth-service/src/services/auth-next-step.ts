export function deriveNextStep(user: any, workspace: any) {
  if (user.email && user.authProvider !== 'google' && !user.emailVerified) {
    return '/onboarding/verify-email';
  }

  const hasBusinessInfo = !!(
    workspace?.business?.name ||
    workspace?.businessDocuments?.submittedAt ||
    workspace?.businessDocuments?.gstNumber ||
    workspace?.industry ||
    workspace?.address
  );
  if (!hasBusinessInfo) {
    return '/onboarding/business-info';
  }

  const isVerificationMandatory =
    (process.env.NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY || 'false') === 'true';
  if (isVerificationMandatory) {
    const verificationStatus = workspace?.businessVerification?.status;
    if (verificationStatus !== 'verified') {
      return '/onboarding/business-verification';
    }
  }

  return null;
}