import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business, Workspace } from '@/lib/models';
import { getOnboardingPath, syncOnboardingState } from '@/lib/services/onboarding/onboarding-state-service';

export const POST = withAuth(async (req: NextRequest, { user, workspace }) => {
  try {
    const body = await req.json();
    const businessName = String(body.businessName || body.name || '').trim();
    if (!businessName) return NextResponse.json({ success: false, message: 'Business name is required' }, { status: 400 });
    if (!body.address || !body.city || !body.state || !body.country || !body.zipCode) {
      return NextResponse.json({ success: false, message: 'Complete business address is required' }, { status: 400 });
    }

    const business = await Business.findOneAndUpdate(
      { workspace: workspace._id },
      {
        $set: {
          workspace: workspace._id,
          owner: user._id,
          name: businessName,
          category: body.category || body.industry,
          address: {
            line1: body.address,
            city: body.city,
            state: body.state,
            country: body.country || 'India',
            postalCode: body.zipCode
          },
          gstNumber: body.gstNumber ? String(body.gstNumber).trim().toUpperCase() : undefined,
          msmeNumber: body.msmeNumber ? String(body.msmeNumber).trim().toUpperCase() : undefined,
          panNumber: body.panNumber ? String(body.panNumber).trim().toUpperCase() : undefined
        }
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspace._id,
      {
        $set: {
          name: businessName,
          industry: body.category || body.industry,
          companySize: body.companySize,
          website: body.website,
          description: body.description,
          address: body.address,
          city: body.city,
          state: body.state,
          country: body.country || 'India',
          zipCode: body.zipCode,
          businessDocuments: {
            gstNumber: body.gstNumber ? String(body.gstNumber).trim().toUpperCase() : undefined,
            msmeNumber: body.msmeNumber ? String(body.msmeNumber).trim().toUpperCase() : undefined,
            panNumber: body.panNumber ? String(body.panNumber).trim().toUpperCase() : undefined,
            documentType: body.gstNumber ? 'gst' : body.msmeNumber ? 'msme' : body.panNumber ? 'pan' : undefined,
            submittedAt: new Date()
          },
          'onboarding.businessInfoCompleted': true,
          'onboarding.businessInfoCompletedAt': new Date(),
          'onboarding.step': 'business-verification',
          'onboarding.status': 'in-progress'
        }
      },
      { returnDocument: 'after' }
    );

    const onboardingState = updatedWorkspace ? await syncOnboardingState(user, updatedWorkspace) : null;
    const nextStep = onboardingState ? (getOnboardingPath(onboardingState.currentStep) || '/dashboard') : '/dashboard';

    return NextResponse.json({
      success: true,
      message: 'Business information saved successfully',
      business,
      nextStep
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to save business information' }, { status: 500 });
  }
});
