import { Router, Request, Response } from 'express';
import { Workspace } from '@/models';
import { GupshupPartnerService } from '@/services/bsp/gupshup-partner-service';
import { config } from '@/config';
import { authenticate, isSuperAdmin } from '@/middlewares/authMiddleware';

const router = Router();

// Diagnostic endpoints in this file enumerate workspace ids, Gupshup app
// ids, secret lengths, and webhook subscription state — that is privileged
// recon data, not a public liveness probe. Lock down everything to
// authenticated super-admins.
router.use(authenticate, isSuperAdmin);

/**
 * GET /api/health/webhooks
 * Check webhook subscription status across all apps
 */
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const webhookUrl = config.whatsappWebhookUrl;
    
    if (!webhookUrl) {
      return res.json({
        status: 'warning',
        message: 'WHATSAPP_WEBHOOK_URL not configured',
        configured: false,
        subscriptions: []
      });
    }

    // Fetch all workspaces with Gupshup apps
    const workspaces = await Workspace.find({
      gupshupAppId: { $exists: true, $ne: null }
    }).select('name gupshupAppId').lean();

    const subscriptions = [];
    const errors = [];

    for (const ws of workspaces) {
      try {
        const subs = await GupshupPartnerService.listSubscriptions(ws.gupshupAppId!);
        const matchingSub = Array.isArray(subs) ? subs.find((s: any) => s.url === webhookUrl) : null;
        
        subscriptions.push({
          workspace: ws.name,
          appId: ws.gupshupAppId,
          found: !!matchingSub,
          webhookUrl: matchingSub?.url || 'NOT SET',
          events: matchingSub?.events || [],
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        const status = error?.response?.status;
        errors.push({
          workspace: ws.name,
          appId: ws.gupshupAppId,
          error: error.message,
          status: status,
          timestamp: new Date().toISOString()
        });
      }
    }

    const allFound = subscriptions.length > 0 && subscriptions.every(s => s.found);
    const hasErrors = errors.length > 0;

    res.json({
      status: allFound && !hasErrors ? 'ok' : hasErrors ? 'error' : 'partial',
      configured: true,
      webhookUrl,
      subscriptions,
      errors,
      summary: {
        total: workspaces.length,
        synced: subscriptions.filter(s => s.found).length,
        failed: errors.length,
        unsynced: subscriptions.filter(s => !s.found).length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/tokens
 * Check token validity (Partner JWT and App keys)
 */
router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const { resolvePartnerToken, resolveAppToken } = await import('@/services/bsp/gupshup-token-service');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check Partner Token
    try {
      const partnerToken = await resolvePartnerToken();
      results.checks.partnerToken = {
        status: !!partnerToken ? 'ok' : 'missing',
        present: !!partnerToken,
        expiresAt: 'not disclosed'
      };
    } catch (error: any) {
      results.checks.partnerToken = {
        status: 'error',
        error: error.message
      };
    }

    // Check App Tokens (sample a few)
    const workspaces = await Workspace.find({
      gupshupAppId: { $exists: true, $ne: null }
    }).select('name gupshupAppId').limit(3).lean();

    results.checks.appTokens = {};
    for (const ws of workspaces) {
      try {
        const appToken = await resolveAppToken(ws.gupshupAppId!);
        results.checks.appTokens[ws.gupshupAppId!] = {
          status: !!appToken ? 'ok' : 'missing',
          workspace: ws.name,
          present: !!appToken
        };
      } catch (error: any) {
        results.checks.appTokens[ws.gupshupAppId!] = {
          status: 'error',
          workspace: ws.name,
          error: error.message
        };
      }
    }

    res.json(results);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/signature-verification
 * Check if webhook signature verification is properly configured
 */
router.get('/signature-verification', (req: Request, res: Response) => {
  const { config } = require('@/config');

  res.json({
    status: 'ok',
    configured: !!config.whatsappWebhookSecret,
    secret: {
      configured: !!config.whatsappWebhookSecret,
      length: config.whatsappWebhookSecret?.length || 0,
      source: config.whatsappWebhookSecretSource || null
    },
    verifyToken: {
      configured: !!config.whatsappWebhookVerifyToken,
      length: config.whatsappWebhookVerifyToken?.length || 0
    },
    requirements: {
      secret: 'Required for signature verification',
      verifyToken: 'Required for webhook challenge verification'
    }
  });
});

export default router;
