import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Business, BusinessAppMap } from '../models';

export const onboardingController = {
  /**
   * Get Onboarding Status
   */
  async getStatus(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const { syncOnboardingState, getOnboardingPath } = await import('../services/onboarding/onboarding-state-service');
      const { isBusinessVerificationMandatory } = await import('../services/business/business-verification-policy-service');

      const state = await syncOnboardingState(user, workspace);
      const business = workspace?._id ? await Business.findOne({ workspace: workspace._id }) : null;
      const appMap = business?._id ? await BusinessAppMap.findOne({ business: business._id, active: true }) : null;
      
      const businessVerificationRequired = await isBusinessVerificationMandatory();
      const businessVerificationSatisfied = !businessVerificationRequired || business?.verificationStatus === 'verified';

      res.json({
        success: true,
        currentStep: state.currentStep,
        nextStep: getOnboardingPath(state.currentStep),
        completed: state.currentStep === 'COMPLETED',
        businessVerificationRequired,
        steps: {
          emailVerified: !!user.emailVerified || user.authProvider === 'google' || !user.email,
          phoneVerified: !!user.phoneVerified,
          businessInfo: !!business,
          businessVerification: businessVerificationSatisfied,
          businessConfirmation: !!business?.confirmed,
          appAssigned: !!appMap || !!workspace?.gupshupAppId,
          whatsappConnected: !!workspace?.whatsappConnected || workspace?.bspPhoneStatus === 'CONNECTED'
        },
        business,
        app: appMap ? { gupshupAppId: appMap.gupshupAppId } : null
      });
    } catch (err: any) {
      console.error("[Onboarding Status Error]:", err.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Save Business Information
   */
  async completeOnboarding(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const { Workspace } = await import('../models');
      
      await Workspace.findByIdAndUpdate(workspace._id, {
        $set: {
          'onboarding.status': 'completed',
          'onboarding.step': 'COMPLETED',
          'onboarding.completedAt': new Date(),
          onboardingStatus: 'COMPLETED'
        }
      });

      const { syncOnboardingState } = await import('../services/onboarding/onboarding-state-service');
      await syncOnboardingState(user, workspace);

      res.json({ success: true, message: "Onboarding completed" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * BSP Callback (Gupshup)
   */
  async bspCallback(req: Request, res: Response) {
    const payload = {
      code: req.query.code || req.query.appId,
      state: req.query.state,
      error: req.query.error,
      message: req.query.error_description || req.query.message
    };
    
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
    const target = `${appOrigin}/dashboard`;

    res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Finishing WhatsApp setup</title></head>
<body>
<p>Finishing WhatsApp setup...</p>
<script>
  (function () {
    var payload = ${JSON.stringify(payload)};
    var appOrigin = ${JSON.stringify(appOrigin)};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GUPSHUP_ONBOARDING_CALLBACK', payload: payload }, appOrigin);
        window.close();
        return;
      }
    } catch (error) {}
    var url = new URL(${JSON.stringify(target)});
    Object.keys(payload).forEach(function (key) { if (payload[key]) url.searchParams.set(key, payload[key]); });
    window.location.replace(url.toString());
  })();
</script>
</body></html>`);
  },

  /**
   * Get BSP Connection Status
   */
  async bspStatus(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const business = await Business.findOne({ workspace: workspace._id });
      const map = business ? await BusinessAppMap.findOne({ business: business._id, active: true }) : null;

      res.json({
        success: true,
        connected: !!workspace?.whatsappConnected || workspace?.bspPhoneStatus === 'CONNECTED',
        status: workspace?.onboardingStatus || workspace?.onboarding?.step || 'not_started',
        app: map ? { gupshupAppId: map.gupshupAppId } : workspace?.gupshupAppId ? { gupshupAppId: workspace.gupshupAppId } : null,
        workspace: {
          id: workspace._id,
          name: workspace.name,
          gupshupAppId: workspace.gupshupAppId,
          phoneNumber: workspace.whatsappPhoneNumber || workspace.bspDisplayPhoneNumber,
          phoneNumberId: workspace.whatsappPhoneNumberId || workspace.bspPhoneNumberId,
          phoneStatus: workspace.bspPhoneStatus,
          connectedAt: workspace.connectedAt
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Start BSP Onboarding
   */
  async bspStart(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const business = await Business.findOne({ workspace: workspace._id });
      if (!business) {
        return res.status(400).json({ success: false, message: 'Complete business profile first' });
      }

      const { startGupshupOnboarding } = await import('../services/bsp/gupshup-app-assignment-service');
      const result = await startGupshupOnboarding(user, workspace, business, req.body);

      res.json({
        success: true,
        url: result.url,
        state: result.state,
        expiresAt: result.expiresAt,
        appId: result.app.gupshupAppId
      });
    } catch (err: any) {
      console.error("[BSP Start Error]:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Sync BSP Data
   */
  async bspSync(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const { syncAssignedGupshupApp } = await import('../services/bsp/gupshup-app-assignment-service');
      const business = await Business.findOne({ workspace: workspace._id });
      
      const updated = await syncAssignedGupshupApp(user, workspace, business);
      res.json({ success: true, workspace: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Disconnect BSP
   */
  async bspDisconnect(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const { Workspace, BusinessAppMap, GupshupApp } = await import('../models');

      const appId = workspace.gupshupAppId;
      if (appId) {
        await GupshupApp.findOneAndUpdate({ gupshupAppId: appId }, { $set: { assigned: false, status: 'disconnected' } });
        await BusinessAppMap.updateMany({ workspace: workspace._id, gupshupAppId: appId }, { $set: { active: false } });
      }

      await Workspace.findByIdAndUpdate(workspace._id, {
        $set: {
          whatsappConnected: false,
          gupshupAppId: undefined,
          gupshupAppName: undefined,
          'onboarding.wabaConnectionCompleted': false,
          bspPhoneStatus: 'DISCONNECTED'
        }
      });

      res.json({ success: true, message: "Disconnected successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },

  /**
   * Register Phone for BSP App
   */
  async bspRegisterPhone(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const { appId, region, phoneNumber } = req.body;
      const targetAppId = appId || workspace.gupshupAppId;
      
      if (!targetAppId) throw new Error("No assigned app found");
      if (String(targetAppId).startsWith('mock_')) return res.json({ success: true, mock: true });

      const { GupshupPartnerService } = await import('../services/bsp/gupshup-partner-service');
      const providerResponse = await GupshupPartnerService.registerPhoneForApp({
        appId: targetAppId,
        region,
        phoneNumber
      });

      res.json({ success: true, appId: targetAppId, providerResponse });
    } catch (err: any) {
      res.status(err.status || 500).json({ success: false, message: err.message });
    }
  },

  /**
   * Complete BSP Setup
   */
  async bspComplete(req: AuthRequest, res: Response) {
    try {
      const { user, workspace } = req;
      const { OnboardingState, Business } = await import('../models');
      const { syncAssignedGupshupApp } = await import('../services/bsp/gupshup-app-assignment-service');
      const { getNextOnboardingPath } = await import('../services/onboarding/onboarding-state-service');
      const { GupshupPartnerService } = await import('../services/bsp/gupshup-partner-service');

      const onboardingState = await OnboardingState.findOne({ user: user._id });
      const bspSession = onboardingState?.metadata?.bspSession as any;
      const business = await Business.findOne({ workspace: workspace._id });

      if (bspSession?.connectionType === 'new_number' && workspace.gupshupAppId) {
        const phone = String(bspSession.phoneNumber || user.phone || workspace.whatsappPhoneNumber || '').replace(/\D/g, '');
        if (phone) {
          await GupshupPartnerService.registerPhoneForApp({
            appId: workspace.gupshupAppId,
            region: bspSession.region,
            phoneNumber: phone
          }).catch(e => console.warn('[BSP Complete] Phone reg fail:', e.message));
        }
      }

      const updated = await syncAssignedGupshupApp(user, workspace, business);
      const nextStep = await getNextOnboardingPath(user, updated || workspace);

      res.json({
        success: true,
        connected: !!updated?.whatsappConnected,
        workspace: updated,
        nextStep
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async bspRuntimeProfile(req: AuthRequest, res: Response) {
    try {
      const { workspace } = req;
      const appId =
        workspace?.gupshupAppId || (workspace as any)?.gupshupIdentity?.partnerAppId;
      if (!appId) {
        return res.json({ success: true, connected: false, profile: null });
      }

      if (String(appId).startsWith('mock_')) {
        return res.json({
          success: true,
          connected: true,
          profile: { app: { id: appId, mock: true }, persisted: workspace }
        });
      }

      const { GupshupPartnerService } = await import('../services/bsp/gupshup-partner-service');
      const [app, waba] = await Promise.allSettled([
        GupshupPartnerService.getPartnerApp(appId),
        GupshupPartnerService.getWabaInfo(appId)
      ]);

      res.json({
        success: true,
        connected: !!workspace?.whatsappConnected,
        profile: {
          persisted: workspace,
          live: {
            app:
              app.status === 'fulfilled'
                ? { ok: true, data: app.value }
                : { ok: false, error: (app as any).reason?.message },
            waba:
              waba.status === 'fulfilled'
                ? { ok: true, data: waba.value }
                : { ok: false, error: (waba as any).reason?.message }
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
