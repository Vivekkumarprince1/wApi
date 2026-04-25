import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business, Workspace } from '@/lib/models';
import { verifyBusinessDocument } from '@/lib/services/onboarding/business-verification-service';
import { getOnboardingPath, syncOnboardingState } from '@/lib/services/onboarding/onboarding-state-service';
import { OnboardingOrchestrator } from '@/lib/services/onboarding/onboarding-orchestrator';
import { isBusinessVerificationMandatory } from '@/lib/services/onboarding/business-verification-policy-service';

export const POST = withAuth(async (req: NextRequest, { user, workspace }) => {
  try {
    const body = await req.json();
    const business = await Business.findOne({ workspace: workspace._id });
    if (!business) {
      return NextResponse.json({ success: false, message: 'Business info must be completed first' }, { status: 400 });
    }

    const gstNumber = body.gstNumber || business.gstNumber;
    const panNumber = body.panNumber || business.panNumber;
    const msmeNumber = body.msmeNumber || business.msmeNumber;
    const verificationRequired = await isBusinessVerificationMandatory();

    business.gstNumber = gstNumber ? String(gstNumber).trim().toUpperCase() : business.gstNumber;
    business.panNumber = panNumber ? String(panNumber).trim().toUpperCase() : business.panNumber;
    business.msmeNumber = msmeNumber ? String(msmeNumber).trim().toUpperCase() : business.msmeNumber;

    if (!verificationRequired) {
      await business.save();

      const refreshedWorkspace = await Workspace.findById(workspace._id);
      const onboardingState = await syncOnboardingState(user, refreshedWorkspace || workspace);

      return NextResponse.json({
        success: true,
        verification: {
          legalName: business.legalName || business.name,
          status: business.verificationStatus,
          provider: business.verificationProvider || 'mock'
        },
        business,
        onboardingStatus: 'COMPLETED',
        nextStep: getOnboardingPath(onboardingState.currentStep) || '/dashboard'
      });
    }

    const result = await verifyBusinessDocument({ gstNumber, panNumber, msmeNumber, businessName: business.name });

    business.legalName = result.legalName;
    business.registryStatus = result.registryStatus;
    business.verificationProvider = result.provider;
    business.verificationStatus = result.registryStatus === 'active' ? 'verified' : 'rejected';
    business.verificationPayload = result.raw;
    business.verifiedAt = result.registryStatus === 'active' ? new Date() : undefined;
    await business.save();

    const verified = business.verificationStatus === 'verified';

    const updatedWorkspace = await Workspace.findByIdAndUpdate(workspace._id, {
      $set: {
        'businessVerification.status': business.verificationStatus,
        'businessVerification.verifiedAt': verified ? new Date() : undefined,
        'businessVerification.lastCheckedAt': new Date(),
        'businessVerification.isTestMode': result.provider === 'mock',
        'onboarding.businessVerificationCompleted': verified,
        'onboarding.businessVerificationCompletedAt': verified ? new Date() : undefined,
        'onboarding.step': verified ? 'provisioning' : 'business-verification',
        'onboarding.status': 'in-progress',
        ...(verified ? { onboardingStatus: 'PROVISIONING_STARTED' } : {})
      }
    }, { returnDocument: 'after' });

    if (updatedWorkspace) {
      await syncOnboardingState(user, updatedWorkspace);
      
      // If verified, trigger the downstream provisioning pipeline (Steps 2-5)
      if (verified) {
        console.log(`[Onboarding] Business verified. Triggering provisioning pipeline for workspace ${workspace._id}...`);
        // We run this in the background/awaited manner. 
        // For better UX during high latency, usually this would be a worker task, 
        // but here we execute it directly to satisfy the "before dashboard" requirement.
        await OnboardingOrchestrator.runProvisioningPipeline(workspace._id.toString()).catch(err => {
          console.error('[Onboarding] Provisioning pipeline failed:', err.message);
        });
      }
    }

    const refreshedWorkspace = updatedWorkspace || await Workspace.findById(workspace._id);
    const onboardingState = await syncOnboardingState(user, refreshedWorkspace || workspace);

    return NextResponse.json({
      success: true,
      verification: {
        legalName: business.legalName,
        status: business.registryStatus,
        provider: result.provider
      },
      business,
      onboardingStatus: verified ? 'PROVISIONING_STARTED' : 'FAILED',
      nextStep: getOnboardingPath(onboardingState.currentStep) || '/dashboard'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status || 500 });
  }
});
