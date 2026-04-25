import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Integration } from '../../models/integration/Integration';
import { IntegrationService } from './integration-orchestrator';

export class GoogleSheetsService {
  /**
   * Get an authorized OAuth2 client for a workspace
   */
  private static async getClient(integration: any) {
    const config = integration.getDecryptedConfig();
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      expiry_date: config.expiryDate
    });

    // Handle token refresh if expired
    client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        config.refreshToken = tokens.refresh_token;
      }
      config.accessToken = tokens.access_token;
      config.expiryDate = tokens.expiry_date;
      
      integration.setEncryptedConfig(config);
      await integration.save();
    });

    return client;
  }

  /**
   * Sync rows from a configured spreadsheet
   */
  static async syncRows(workspaceId: string) {
    const integration = await Integration.findOne({ 
      workspace: workspaceId, 
      type: 'google_sheets', 
      status: 'connected' 
    }).select('+config');

    if (!integration) return;

    try {
      const client = await this.getClient(integration);
      const sheets = google.sheets({ version: 'v4', auth: client });
      const config = integration.getDecryptedConfig();

      if (!config.spreadsheetId || !config.sheetName) {
        console.warn(`[GoogleSheetsService] Missing spreadsheetId or sheetName for workspace ${workspaceId}`);
        return;
      }

      // Fetch the entire sheet (simplification for MVP; could be optimized with ranges)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `${config.sheetName}!A:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return; // Only header or empty

      const header = rows[0];
      const dataRows = rows.slice(1);
      
      // We use row index + lastSyncAt to determine "newness"
      // Better strategy: Store the last processed row index in configMetadata
      const lastProcessedIndex = integration.configMetadata?.lastProcessedIndex || 0;
      const newRows = dataRows.slice(lastProcessedIndex);

      for (let i = 0; i < newRows.length; i++) {
        const rowData: Record<string, any> = {
          sheetId: config.spreadsheetId,
          rowNumber: lastProcessedIndex + i + 2, // 1-indexed, +1 for header
        };

        header.forEach((col: string, idx: number) => {
          rowData[col] = newRows[i][idx];
        });

        await IntegrationService.handleExternalEvent('google-sheets', workspaceId, rowData);
      }

      // Update metadata
      integration.configMetadata = {
        ...integration.configMetadata,
        lastProcessedIndex: lastProcessedIndex + newRows.length
      };

      await integration.markSynced(newRows.length);
      console.log(`[GoogleSheetsService] Sync complete for ${workspaceId}: ${newRows.length} new rows.`);

    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      console.error(`[GoogleSheetsService] Sync failed for ${workspaceId}:`, errorMsg);
      
      // Update status if it's a permanent failure (e.g. 404 or auth revoked)
      if (error.code === 404 || error.response?.status === 404) {
        await integration.markError('Spreadsheet not found. Please re-configure.', 'GS_NOT_FOUND');
      } else if (error.code === 403 || error.response?.status === 401) {
        await integration.markError('Authentication revoked. Please reconnect.', 'GS_AUTH_REVOKED');
      } else {
        await integration.markError(errorMsg, 'GS_SYNC_FAILED');
      }
    }
  }

  /**
   * Process a single row instantly (Push-based)
   */
  static async processInstantRow(workspaceId: string, rowData: any) {
    try {
      // 1. Trigger Automation
      await IntegrationService.handleExternalEvent('google-sheets', workspaceId, rowData);

      // 2. Synchronize Index (Optional but recommended to avoid double-processing if poller runs)
      // If the payload includes a rowNumber, we can update the integration metadata
      if (rowData.rowNumber) {
        const { Integration } = await import('../../models/integration/Integration');
        await Integration.updateOne(
          { workspace: workspaceId, type: 'google_sheets' },
          { $max: { 'configMetadata.lastProcessedIndex': rowData.rowNumber } }
        );
      }
    } catch (error: any) {
      console.error(`[GoogleSheetsService] Instant process failed for ${workspaceId}:`, error.message);
    }
  }

  /**
   * Fetch all rows from a spreadsheet for a one-time broadcast
   */
  static async fetchAllRows(workspaceId: string, spreadsheetId: string, sheetName: string) {
    const integration = await Integration.findOne({ 
      workspace: workspaceId, 
      type: 'google_sheets', 
      status: 'connected' 
    }).select('+config');

    if (!integration) throw new Error('Google Sheets not connected');

    try {
      const client = await this.getClient(integration);
      const sheets = google.sheets({ version: 'v4', auth: client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return [];

      const header = rows[0];
      const dataRows = rows.slice(1);
      
      return dataRows.map((row, rowIdx) => {
        const rowData: Record<string, any> = {
          rowNumber: rowIdx + 2 // 1-indexed, +1 for header
        };
        header.forEach((col: string, idx: number) => {
          rowData[col] = row[idx];
        });
        return rowData;
      });
    } catch (error: any) {
      console.error(`[GoogleSheetsService] Fetch all failed for ${workspaceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get column headers for a specific sheet
   */
  static async getColumns(workspaceId: string, spreadsheetId: string, sheetName: string) {
    const integration = await Integration.findOne({ 
      workspace: workspaceId, 
      type: 'google_sheets', 
      status: 'connected' 
    }).select('+config');

    if (!integration) throw new Error('Google Sheets not connected');

    try {
      const client = await this.getClient(integration);
      const sheets = google.sheets({ version: 'v4', auth: client });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`, // Only first row
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];
      return rows[0]; // Return the header row
    } catch (error: any) {
      console.error(`[GoogleSheetsService] Get columns failed for ${workspaceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Helper to list spreadsheets for the UI picker
   */
  static async listSpreadsheets(integration: any) {
    const client = await this.getClient(integration);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
    });

    return response.data.files || [];
  }
}
