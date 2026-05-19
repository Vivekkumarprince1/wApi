import { Request, Response } from 'express';
// @ts-ignore
import { Business } from '../models/business/Business';

export interface AuthRequest extends Request {
  user?: any;
  workspace?: any;
}

export const businessController = {
  async saveBusinessInfo(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const body = req.body;
      const businessName = String(body.businessName || body.name || '').trim();

      if (!businessName) return res.status(400).json({ success: false, message: 'Business name is required' });
      if (!body.address || !body.city || !body.state || !body.country || !body.zipCode) {
        return res.status(400).json({ success: false, message: 'Complete business address is required' });
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
              country: body.country,
              zipCode: body.zipCode
            },
            contactEmail: body.email,
            contactPhone: body.phone,
            gstNumber: body.gstNumber,
            panNumber: body.panNumber,
            msmeNumber: body.msmeNumber
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const { Workspace } = await import('../models/workspace/Workspace');
      const updatedWorkspace = await Workspace.findByIdAndUpdate(workspace._id, {
        $set: {
          'onboarding.businessInfoCompleted': true,
          'onboarding.businessInfoCompletedAt': new Date(),
          'onboarding.step': 'business-verification',
          'onboarding.status': 'in-progress'
        }
      }, { returnDocument: 'after' });

      // @ts-ignore
      const { syncOnboardingState } = await import('../services/onboarding/onboarding-state-service');
      const state = await syncOnboardingState(user, updatedWorkspace);

      res.json({ success: true, business, state });
    } catch (error: any) {
      console.error('Error saving business info:', error);
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  },

  async verifyBusiness(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const body = req.body;
      const business = await Business.findOne({ workspace: workspace._id });
      
      if (!business) {
        return res.status(400).json({ success: false, message: 'Business info must be completed first' });
      }

      // @ts-ignore
      const { verifyBusinessDocument } = await import('../services/business/business-verification-service');
      // @ts-ignore
      const { isBusinessVerificationMandatory } = await import('../services/business/business-verification-policy-service');
      // @ts-ignore
      const { syncOnboardingState, getOnboardingPath } = await import('../services/onboarding/onboarding-state-service');
      
      const gstNumber = body.gstNumber || business.gstNumber;
      const panNumber = body.panNumber || business.panNumber;
      const msmeNumber = body.msmeNumber || business.msmeNumber;
      const verificationRequired = await isBusinessVerificationMandatory();

      if (!verificationRequired) {
        business.verificationStatus = 'verified';
        await business.save();

        const { Workspace } = await import('../models/workspace/Workspace');
        const refreshedWorkspace = await Workspace.findById(workspace._id);
        const onboardingState = await syncOnboardingState(user, refreshedWorkspace || workspace);

        return res.json({
          success: true,
          verification: { status: 'verified', provider: 'none' },
          nextStep: getOnboardingPath(onboardingState.currentStep),
          state: onboardingState
        });
      }

      const result = await verifyBusinessDocument({ gstNumber, panNumber, msmeNumber, businessName: business.name });
      
      business.legalName = result.legalName;
      business.registryStatus = result.registryStatus;
      business.verificationProvider = result.provider;
      business.verificationStatus = result.registryStatus === 'active' ? 'verified' : 'rejected';
      business.verifiedAt = result.registryStatus === 'active' ? new Date() : undefined;
      await business.save();

      const verified = business.verificationStatus === 'verified';
      const { Workspace } = await import('../models/workspace/Workspace');
      const updatedWorkspace = await Workspace.findByIdAndUpdate(workspace._id, {
        $set: {
          'onboarding.businessVerificationCompleted': verified,
          'onboarding.businessVerificationCompletedAt': verified ? new Date() : undefined,
          'onboarding.step': verified ? 'provisioning' : 'business-verification',
          'onboarding.status': 'in-progress',
          ...(verified ? { onboardingStatus: 'PROVISIONING_STARTED' } : {})
        }
      }, { returnDocument: 'after' });

      const state = await syncOnboardingState(user, updatedWorkspace || workspace);

      res.json({
        success: true,
        verification: result,
        nextStep: getOnboardingPath(state.currentStep),
        state
      });
    } catch (error: any) {
      console.error('Error verifying business:', error);
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }
};
