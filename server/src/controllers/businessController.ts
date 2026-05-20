import { Request, Response } from 'express';
// @ts-ignore
import { Business } from '../models/business/Business';
// @ts-ignore
import { Workspace } from '../models/workspace/Workspace';
// @ts-ignore
import { BspServiceClient } from '../services/microservices/bsp-service-client';

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

      // --- SYNC WORKSPACE LOCAL CACHE ---
      await Workspace.findByIdAndUpdate(
        workspace._id,
        {
          $set: {
            industry: body.category || body.industry,
            website: body.website,
            address: body.address,
            city: body.city,
            state: body.state,
            country: body.country,
            zipCode: body.zipCode,
            businessDocuments: {
              gstNumber: body.gstNumber,
              panNumber: body.panNumber,
              msmeNumber: body.msmeNumber,
              documentType: body.documentType || 'other',
              documentUrl: body.documentUrl,
              submittedAt: new Date()
            }
          }
        }
      );

      // Notify bsp-service that business info step is complete
      try {
        await BspServiceClient.request({
          method: 'POST',
          path: '/internal/v1/bsp/onboarding/sync-state',
          data: { workspaceId: workspace._id.toString(), step: 'BUSINESS_INFO' }
        });
      } catch (bspError: any) {
        console.warn('[Business Info Save] Failed to sync state with bsp-service:', bspError.message);
      }

      res.json({ success: true, business });
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

      const gstNumber = body.gstNumber || business.gstNumber;
      const panNumber = body.panNumber || business.panNumber;
      const msmeNumber = body.msmeNumber || business.msmeNumber;
      const verificationRequired = await isBusinessVerificationMandatory();

      if (!verificationRequired) {
        business.verificationStatus = 'verified';
        await business.save();

        // --- SYNC WORKSPACE LOCAL CACHE ---
        await Workspace.findByIdAndUpdate(
          workspace._id,
          {
            $set: {
              'businessVerification.status': 'verified',
              'businessVerification.verifiedAt': new Date(),
              'businessVerification.lastCheckedAt': new Date()
            }
          }
        );

        // Sync with BSP service's onboarding state
        try {
          await BspServiceClient.request({
            method: 'POST',
            path: '/internal/v1/bsp/onboarding/sync-state',
            data: { workspaceId: workspace._id.toString(), step: 'BUSINESS_VERIFICATION' }
          });
        } catch (bspError: any) {
          console.warn('[Business Verify] Failed to sync state with bsp-service:', bspError.message);
        }

        return res.json({
          success: true,
          verification: { status: 'verified', provider: 'none' }
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

      // --- SYNC WORKSPACE LOCAL CACHE ---
      await Workspace.findByIdAndUpdate(
        workspace._id,
        {
          $set: {
            'businessVerification.status': verified ? 'verified' : 'rejected',
            'businessVerification.verifiedAt': verified ? new Date() : undefined,
            'businessVerification.rejectionReason': verified ? undefined : ((result as any).message || `Registry status is ${result.registryStatus}`),
            'businessVerification.lastCheckedAt': new Date()
          }
        }
      );

      // Notify bsp-service when verification passes
      if (verified) {
        try {
          await BspServiceClient.request({
            method: 'POST',
            path: '/internal/v1/bsp/onboarding/sync-state',
            data: { workspaceId: workspace._id.toString(), step: 'BUSINESS_VERIFICATION' }
          });
        } catch (bspError: any) {
          console.warn('[Business Verify] Failed to sync state with bsp-service:', bspError.message);
        }
      }

      res.json({
        success: true,
        verification: result
      });
    } catch (error: any) {
      console.error('Error verifying business:', error);
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }
};
