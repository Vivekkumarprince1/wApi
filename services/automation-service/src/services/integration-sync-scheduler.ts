/**
 * integration-sync-scheduler.ts — automation-service
 *
 * In-process scheduler (no BullMQ) that periodically syncs active integrations:
 *   - Google Sheets: every 15 minutes
 *   - Petpooja:      every 5 minutes
 *   - Instagram:     refresh expiring long-lived tokens daily
 *
 * Mirrors the old IntegrationSyncWorker from the backup but uses setInterval
 * so no additional dependencies are required.
 *
 * Lifecycle:
 *   startIntegrationSyncScheduler()  — call once after DB is ready
 *   stopIntegrationSyncScheduler()   — call during SIGTERM
 */

import { GoogleSheetsService } from './integrations/google-sheets-service';
import { PetpoojaService } from './integrations/petpooja-service';
import { InstagramBusinessService } from './integrations/instagram-business-service';
import { Integration } from '../models';

const GOOGLE_SHEETS_INTERVAL_MS = 15 * 60 * 1000; //  15 minutes
const PETPOOJA_INTERVAL_MS = 5 * 60 * 1000;       //   5 minutes
const INSTAGRAM_TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const INSTAGRAM_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // refresh during final 7 days

let googleSheetsHandle: ReturnType<typeof setInterval> | null = null;
let petpoojaHandle: ReturnType<typeof setInterval> | null = null;
let instagramHandle: ReturnType<typeof setInterval> | null = null;

async function syncGoogleSheets(): Promise<void> {
  try {
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return;

    const integrations = await db
      .collection('integrations')
      .find({ type: 'google_sheets', status: 'connected' })
      .toArray();

    for (const integration of integrations) {
      try {
        await GoogleSheetsService.syncRows(String(integration.workspace));
      } catch (err: any) {
        console.error(`[IntegrationSync] GoogleSheets failed for workspace ${integration.workspace}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[IntegrationSync] GoogleSheets scheduler error:', err.message);
  }
}

async function syncPetpooja(): Promise<void> {
  try {
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return;

    const integrations = await db
      .collection('integrations')
      .find({ type: 'petpooja', status: 'connected' })
      .toArray();

    for (const integration of integrations) {
      try {
        await PetpoojaService.syncOrders(String(integration.workspace));
      } catch (err: any) {
        console.error(`[IntegrationSync] Petpooja failed for workspace ${integration.workspace}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[IntegrationSync] Petpooja scheduler error:', err.message);
  }
}

async function refreshInstagramTokens(): Promise<void> {
  try {
    const refreshBefore = new Date(Date.now() + INSTAGRAM_REFRESH_WINDOW_MS);
    const integrations = await (Integration as any)
      .find({
        type: 'instagram',
        status: { $in: ['connected', 'pending'] },
        'credentials.expiresAt': { $lte: refreshBefore },
      })
      .select('+config');

    for (const integration of integrations) {
      try {
        const storedConfig = integration.getDecryptedConfig?.() || {};
        const accessToken = storedConfig?.tokens?.accessToken;
        if (!accessToken) continue;

        const refreshedToken = await InstagramBusinessService.refreshLongLivedToken(accessToken);
        integration.configMetadata = {
          ...(integration.configMetadata || {}),
          tokenExpiresAt: refreshedToken.expiresAt,
          tokenRefreshedAt: new Date(),
        };
        integration.credentials = {
          isExpiring: Boolean(refreshedToken.expiresAt),
          expiresAt: refreshedToken.expiresAt,
          needsReauth: false,
        };
        integration.setEncryptedConfig({
          ...storedConfig,
          tokens: {
            ...(storedConfig.tokens || {}),
            accessToken: refreshedToken.accessToken,
            tokenType: refreshedToken.tokenType,
            expiresIn: refreshedToken.expiresIn,
            expiresAt: refreshedToken.expiresAt?.toISOString(),
          },
        });
        await integration.markSynced(0);
      } catch (err: any) {
        await integration.markError(err?.response?.data?.error?.message || err.message, 'INSTAGRAM_TOKEN_REFRESH_FAILED');
        console.error(`[IntegrationSync] Instagram token refresh failed for workspace ${integration.workspace}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[IntegrationSync] Instagram scheduler error:', err.message);
  }
}

/** Start the integration sync scheduler. Safe to call multiple times — idempotent. */
export function startIntegrationSyncScheduler(): void {
  if (googleSheetsHandle && petpoojaHandle && instagramHandle) return;

  googleSheetsHandle = setInterval(() => {
    syncGoogleSheets().catch((err: any) =>
      console.error('[IntegrationSync] Unhandled GoogleSheets error:', err.message),
    );
  }, GOOGLE_SHEETS_INTERVAL_MS);

  petpoojaHandle = setInterval(() => {
    syncPetpooja().catch((err: any) =>
      console.error('[IntegrationSync] Unhandled Petpooja error:', err.message),
    );
  }, PETPOOJA_INTERVAL_MS);

  instagramHandle = setInterval(() => {
    refreshInstagramTokens().catch((err: any) =>
      console.error('[IntegrationSync] Unhandled Instagram refresh error:', err.message),
    );
  }, INSTAGRAM_TOKEN_REFRESH_INTERVAL_MS);

  console.log('[IntegrationSync] 📅 Scheduler started — GoogleSheets (15m), Petpooja (5m), Instagram token refresh (daily).');
}

/** Stop the integration sync scheduler (call during graceful shutdown). */
export function stopIntegrationSyncScheduler(): void {
  if (googleSheetsHandle) { clearInterval(googleSheetsHandle); googleSheetsHandle = null; }
  if (petpoojaHandle) { clearInterval(petpoojaHandle); petpoojaHandle = null; }
  if (instagramHandle) { clearInterval(instagramHandle); instagramHandle = null; }
  console.log('[IntegrationSync] Scheduler stopped.');
}
