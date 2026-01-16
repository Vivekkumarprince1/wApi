const cron = require('node-cron');
const Workspace = require('../models/Workspace');
const secretsManager = require('./secretsManager');
const metaAutomationService = require('./metaAutomationService');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

/**
 * TOKEN REFRESH CRON SERVICE
 * 
 * Risk: Long-lived access tokens expire after 60 days. Without refresh, workspaces go offline.
 * Interakt Approach:
 * 1. Cron runs daily (or every 6h for safety)
 * 2. Query: workspaces with tokens expiring in next 7 days
 * 3. For each: Call Meta /oauth/access_token with refresh_token
 * 4. On success: Update vault + workspace metadata
 * 5. On failure: Retry with exponential backoff + alert admin
 * 
 * Implementation:
 * - Schedule: Every 6 hours (0000, 0600, 1200, 1800 UTC)
 * - Retry: 3 attempts with exponential backoff (60s, 300s, 900s)
 * - Failure: Alert + manual intervention flag
 * 
 * Meta API: POST /oauth/access_token?grant_type=refresh_token
 */

class TokenRefreshCron {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.failureCount = 0;
  }

  /**
   * Initialize cron job
   * Schedule: 0000, 0600, 1200, 1800 UTC
   */
  start() {
    // Run every 6 hours
    this.cronJob = cron.schedule('0 0,6,12,18 * * *', async () => {
      await this.executeRefresh();
    });

    logger.info('[TokenRefreshCron] Cron job started - runs every 6 hours');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('[TokenRefreshCron] Cron job stopped');
    }
  }

  /**
   * Main refresh execution
   * Called by cron scheduler
   */
  async executeRefresh() {
    if (this.isRunning) {
      logger.warn('[TokenRefreshCron] Previous refresh still running, skipping');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      logger.info('[TokenRefreshCron] Starting token refresh cycle');

      // Find workspaces with tokens expiring in next 7 days
      const workspacesToRefresh = await this._findWorkspacesNeedingRefresh();
      logger.info(`[TokenRefreshCron] Found ${workspacesToRefresh.length} workspaces to refresh`);

      if (workspacesToRefresh.length === 0) {
        logger.info('[TokenRefreshCron] No workspaces need token refresh');
        this.isRunning = false;
        return;
      }

      // Refresh each workspace
      const results = [];
      for (const workspace of workspacesToRefresh) {
        const result = await this._refreshWorkspaceToken(workspace);
        results.push(result);
      }

      // Summary
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      logger.info('[TokenRefreshCron] Refresh cycle complete', {
        total: results.length,
        succeeded,
        failed,
      });

      // Alert on failures
      if (failed > 0) {
        await this._alertFailures(results.filter((r) => !r.success));
      }

      this.failureCount = failed;
    } catch (error) {
      logger.error('[TokenRefreshCron] executeRefresh failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * INTERNAL: Find workspaces needing token refresh
   * Query: refreshToken exists + token expires in next 7 days
   */
  async _findWorkspacesNeedingRefresh() {
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const workspaces = await Workspace.find({
        // Has refresh token
        'esbFlow.hasRefreshToken': true,
        // Token expiration is within 7 days OR no expiration tracked (refresh anyway)
        $or: [
          { 'esbFlow.tokenExpiresAt': { $lte: sevenDaysFromNow } },
          { 'esbFlow.tokenExpiresAt': null },
        ],
        // Not already in failure state
        'esbFlow.tokenRefreshFailureCount': { $lt: 3 },
      })
        .select('_id esbFlow phoneNumbers')
        .lean();

      return workspaces;
    } catch (error) {
      logger.error('[TokenRefreshCron] _findWorkspacesNeedingRefresh failed:', error);
      return [];
    }
  }

  /**
   * INTERNAL: Refresh token for single workspace
   * Implements retry logic with exponential backoff
   */
  async _refreshWorkspaceToken(workspace) {
    const workspaceId = workspace._id;
    const maxRetries = 3;
    const backoffDurations = [60000, 300000, 900000]; // 1m, 5m, 15m

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current refresh token from vault
        const refreshToken = await secretsManager.retrieveRefreshToken(
          workspaceId.toString()
        );

        if (!refreshToken) {
          logger.warn(`[TokenRefreshCron] No refresh token found for workspace:`, {
            workspaceId,
          });

          return {
            workspaceId,
            success: false,
            error: 'NO_REFRESH_TOKEN',
            attempt: attempt + 1,
          };
        }

        // Call Meta OAuth endpoint
        const newAccessToken = await this._callMetaTokenRefresh(
          refreshToken,
          workspace.phoneNumbers[0]?.phone_number_id
        );

        // Store new token in vault
        await secretsManager.storeToken(workspaceId.toString(), newAccessToken);

        // Update workspace metadata
        await Workspace.findByIdAndUpdate(workspaceId, {
          $set: {
            'esbFlow.lastTokenRefresh': new Date(),
            'esbFlow.tokenExpiresAt': new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
            'esbFlow.tokenRefreshFailureCount': 0,
          },
        });

        // Audit log
        await AuditLog.create({
          workspaceId,
          entityType: 'token',
          entityId: 'access_token',
          action: 'refresh_success',
          details: { attempt: attempt + 1 },
          status: 'success',
        });

        logger.info('[TokenRefreshCron] Token refreshed successfully', {
          workspaceId,
          attempt: attempt + 1,
        });

        return { workspaceId, success: true, attempt: attempt + 1 };
      } catch (error) {
        logger.warn(`[TokenRefreshCron] Refresh attempt ${attempt + 1} failed:`, {
          workspaceId,
          error: error.message,
        });

        // On last attempt, record failure
        if (attempt === maxRetries - 1) {
          await Workspace.findByIdAndUpdate(workspaceId, {
            $inc: { 'esbFlow.tokenRefreshFailureCount': 1 },
            $set: { 'esbFlow.tokenRefreshLastError': error.message },
          });

          await AuditLog.create({
            workspaceId,
            entityType: 'token',
            entityId: 'access_token',
            action: 'refresh_failed',
            details: {
              attempts: maxRetries,
              error: error.message,
            },
            status: 'critical',
          });

          return {
            workspaceId,
            success: false,
            error: error.message,
            attempt: attempt + 1,
          };
        }

        // Exponential backoff before retry
        const backoffDuration = backoffDurations[attempt];
        logger.info('[TokenRefreshCron] Retrying after backoff', {
          workspaceId,
          backoffSeconds: backoffDuration / 1000,
        });

        await new Promise((resolve) => setTimeout(resolve, backoffDuration));
      }
    }
  }

  /**
   * INTERNAL: Call Meta OAuth token refresh endpoint
   * https://developers.facebook.com/docs/facebook-login/guides/access-tokens/refreshing
   * 
   * Endpoint: POST /oauth/access_token
   * Params:
   *   - grant_type=refresh_token
   *   - client_id={APP_ID}
   *   - client_secret={APP_SECRET}
   *   - access_token={CURRENT_REFRESH_TOKEN}
   */
  async _callMetaTokenRefresh(refreshToken, phoneNumberId) {
    try {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;

      if (!appId || !appSecret) {
        throw new Error('Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET');
      }

      const response = await require('axios').post(
        'https://graph.instagram.com/oauth/access_token',
        {
          grant_type: 'refresh_token',
          client_id: appId,
          client_secret: appSecret,
          access_token: refreshToken,
        }
      );

      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid token refresh response from Meta');
      }

      return response.data.access_token;
    } catch (error) {
      logger.error('[TokenRefreshCron] _callMetaTokenRefresh failed:', error);
      throw error;
    }
  }

  /**
   * INTERNAL: Alert admin on token refresh failures
   */
  async _alertFailures(failures) {
    try {
      logger.error('[TokenRefreshCron] Token refresh failures detected:', {
        count: failures.length,
        failures: failures.map((f) => ({
          workspaceId: f.workspaceId,
          error: f.error,
        })),
      });

      // TODO: Send admin alert via Slack/Email
      // await NotificationService.alertAdmins('Token Refresh Failures', failures);
    } catch (error) {
      logger.error('[TokenRefreshCron] _alertFailures failed:', error);
    }
  }

  /**
   * Health check endpoint for monitoring
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      failureCount: this.failureCount,
    };
  }
}

module.exports = new TokenRefreshCron();
