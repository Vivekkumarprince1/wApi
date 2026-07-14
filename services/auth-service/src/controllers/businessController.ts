import express from 'express';
import axios from 'axios';
import { Workspace, Business } from '../models/index.js';
import { AuthRequest } from '../middleware/businessAuth.js';
import { verifyBusinessDocument } from '../services/business-verification-service.js';

export const saveBusinessInfo = async (req: AuthRequest, res: express.Response) => {
  try {
    const { user, workspace } = req;
    const body = req.body || {};
    const businessName = String(body.businessName || body.name || '').trim();

    if (!businessName) {
      return res.status(400).json({ success: false, message: 'Business name is required' });
    }
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
            postalCode: body.zipCode
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

    // Sync to local Workspace cache model matching legacy behavior
    await Workspace.findByIdAndUpdate(workspace._id, {
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
    });

    // Notify bsp-service of onboarding state progression
    try {
      const bspUrl = process.env.BSP_SERVICE_URL || 'http://localhost:3004';
      const secret = process.env.INTERNAL_SERVICE_SECRET!;
      await axios.post(
        `${bspUrl.replace(/\/$/, '')}/internal/v1/bsp/onboarding/sync-state`,
        { workspaceId: workspace._id.toString(), step: 'BUSINESS_INFO' },
        {
          headers: {
            'x-internal-service-secret': secret,
            'x-internal-service': 'auth-service'
          }
        }
      );
    } catch (bspErr: any) {
      console.warn('[Business Info] Failed to sync onboarding step with BSP provider service:', bspErr.message);
    }

    // If business verification is not mandatory, auto-verify so user proceeds to dashboard
    const isVerificationMandatory = (process.env.NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY || 'false') === 'true';
    let nextStep = isVerificationMandatory ? '/onboarding/business-verification' : '/dashboard';

    if (!isVerificationMandatory) {
      await Workspace.findByIdAndUpdate(workspace._id, {
        $set: {
          'businessVerification.status': 'verified',
          'businessVerification.verifiedAt': new Date(),
          'businessVerification.lastCheckedAt': new Date()
        }
      });
    }

    return res.status(200).json({ success: true, business, nextStep });
  } catch (error: any) {
    console.error('Error saving business info:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

export const verifyBusiness = async (req: AuthRequest, res: express.Response) => {
  try {
    const { workspace } = req;
    const body = req.body || {};
    const business = await Business.findOne({ workspace: workspace._id });

    if (!business) {
      return res.status(400).json({ success: false, message: 'Business info must be completed first' });
    }

    const gstNumber = body.gstNumber || business.gstNumber;
    const panNumber = body.panNumber || business.panNumber;
    const msmeNumber = body.msmeNumber || business.msmeNumber;

    const isMandatory = (process.env.NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY || 'false') === 'true';

    if (!isMandatory) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: 'Business verification is not enabled for this deployment',
          requestId: req.headers['x-correlation-id'] || null,
        },
      });

      return res.status(200).json({
        success: true,
        verification: { status: 'verified', provider: 'none' }
      });
    }

    // Call document verification service
    const result = await verifyBusinessDocument({ gstNumber, panNumber, msmeNumber, businessName: business.name });

    business.legalName = result.legalName;
    business.registryStatus = result.registryStatus;
    business.verificationProvider = result.provider;
    business.verificationStatus = result.registryStatus === 'active' ? 'verified' : 'rejected';
    business.verifiedAt = result.registryStatus === 'active' ? new Date() : undefined;
    await business.save();

    const verified = business.verificationStatus === 'verified';

    // Update local Workspace cache model matching legacy behavior
    await Workspace.findByIdAndUpdate(workspace._id, {
      $set: {
        'businessVerification.status': verified ? 'verified' : 'rejected',
        'businessVerification.verifiedAt': verified ? new Date() : undefined,
        'businessVerification.rejectionReason': verified ? undefined : ((result as any).message || `Registry status is ${result.registryStatus}`),
        'businessVerification.lastCheckedAt': new Date()
      }
    });

    // Notify bsp-service when verification succeeds
    if (verified) {
      try {
        const bspUrl = process.env.BSP_SERVICE_URL || 'http://localhost:3004';
        const secret = process.env.INTERNAL_SERVICE_SECRET!;
        await axios.post(
          `${bspUrl.replace(/\/$/, '')}/internal/v1/bsp/onboarding/sync-state`,
          { workspaceId: workspace._id.toString(), step: 'BUSINESS_VERIFICATION' },
          {
            headers: {
              'x-internal-service-secret': secret,
              'x-internal-service': 'auth-service'
            }
          }
        );
      } catch (bspErr: any) {
        console.warn('[Business Verify] Failed to sync onboarding step with BSP provider service:', bspErr.message);
      }
    }

    return res.status(200).json({ success: true, verification: result });
  } catch (error: any) {
    console.error('Error verifying business:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
