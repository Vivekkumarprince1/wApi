import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { Integration } from '../../models';
import { contactInternalClient } from '../../lib/internal-client';
import { AutomationService } from '../automation-service';

type SheetRow = Record<string, any> & {
  __rowNumber: number;
  __raw: any[];
};

const SHEETS_READ_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';

function requireGoogleEnv() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Sheets integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
}

function createOAuthClient(redirectUri?: string): OAuth2Client {
  requireGoogleEnv();
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_REDIRECT_URI
  );
}

function escapeSheetName(sheetName: string) {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
}

function normalizeHeader(header: string) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickFirst(row: Record<string, any>, candidates: string[]) {
  for (const key of candidates) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function getPhone(row: Record<string, any>) {
  return pickFirst(row, ['phone', 'mobile', 'mobile_number', 'whatsapp', 'whatsapp_number', 'contact', 'contact_number']);
}

function getName(row: Record<string, any>) {
  const fullName = pickFirst(row, ['name', 'full_name', 'customer_name', 'contact_name']);
  if (fullName) return String(fullName);
  const first = pickFirst(row, ['first_name', 'firstname']);
  const last = pickFirst(row, ['last_name', 'lastname']);
  return [first, last].filter(Boolean).join(' ').trim();
}

async function getConnectedIntegration(workspaceId: string) {
  return (Integration as any)
    .findOne({ workspace: workspaceId, type: 'google_sheets', status: 'connected' })
    .select('+config');
}

async function getAuthForIntegration(integration: any, redirectUri?: string) {
  const auth = createOAuthClient(redirectUri);
  const config = integration.getDecryptedConfig?.() || {};
  const tokens = config.tokens || config;

  if (!tokens?.refresh_token && !tokens?.access_token) {
    throw new Error('Google Sheets authorization is incomplete. Reconnect Google Sheets.');
  }

  auth.setCredentials(tokens);
  return auth;
}

async function resolveContact(workspaceId: string, row: Record<string, any>) {
  const phone = getPhone(row);
  if (!phone) return null;

  const response = await contactInternalClient.post('/internal/v1/contacts/resolve', {
    workspaceId,
    phone,
    name: getName(row) || String(phone),
  }, {
    headers: { 'x-workspace-id': workspaceId }
  });

  return response.data?.data || response.data;
}

export class GoogleSheetsService {
  static generateAuthUrl(params: { workspaceId: string; userId?: string; redirectUri: string; returnTo?: string }) {
    const client = createOAuthClient(params.redirectUri);
    const state = Buffer.from(JSON.stringify({
      workspaceId: params.workspaceId,
      userId: params.userId,
      returnTo: params.returnTo,
      redirectUri: params.redirectUri,
    })).toString('base64url');

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [SHEETS_READ_SCOPE, DRIVE_METADATA_SCOPE],
      state,
    });
  }

  static parseState(rawState: unknown) {
    if (typeof rawState !== 'string' || !rawState) return {};
    try {
      return JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  }

  static async exchangeCode(code: string, redirectUri: string) {
    const client = createOAuthClient(redirectUri);
    const { tokens } = await client.getToken(code);
    return tokens;
  }

  static async listSpreadsheets(integration: any) {
    const auth = await getAuthForIntegration(integration);
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id,name,modifiedTime,webViewLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
    });

    return response.data.files || [];
  }

  static async listSheets(workspaceId: string, spreadsheetId: string) {
    const integration = await getConnectedIntegration(workspaceId);
    if (!integration) throw new Error('Google Sheets is not connected.');

    const auth = await getAuthForIntegration(integration);
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    return (response.data.sheets || [])
      .map((sheet) => sheet.properties?.title)
      .filter(Boolean);
  }

  static async fetchAllRows(workspaceId: string, spreadsheetId: string, sheetName: string): Promise<SheetRow[]> {
    const integration = await getConnectedIntegration(workspaceId);
    if (!integration) throw new Error('Google Sheets is not connected.');

    const auth = await getAuthForIntegration(integration);
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(sheetName)}!A:ZZ`,
      majorDimension: 'ROWS',
    });

    const values = response.data.values || [];
    const headers = (values[0] || []).map((cell: any, index: number) =>
      normalizeHeader(cell) || `column_${index + 1}`
    );

    return values.slice(1).map((cells: any[], rowIndex: number) => {
      const row: SheetRow = {
        __rowNumber: rowIndex + 2,
        __raw: cells,
      };

      headers.forEach((header: string, index: number) => {
        row[header] = cells[index] ?? '';
      });

      return row;
    });
  }

  static async getColumns(workspaceId: string, spreadsheetId: string, sheetName: string) {
    const integration = await getConnectedIntegration(workspaceId);
    if (!integration) throw new Error('Google Sheets is not connected.');

    const auth = await getAuthForIntegration(integration);
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(sheetName)}!1:1`,
      majorDimension: 'ROWS',
    });

    const headerRow = response.data.values?.[0] || [];
    return headerRow.map((label: any, index: number) => normalizeHeader(label) || `column_${index + 1}`);
  }

  static async processInstantRow(workspaceId: string, rowData: Record<string, any>) {
    const contact = await resolveContact(workspaceId, rowData);
    await AutomationService.trigger(workspaceId, 'google_sheets.row.created', {
      row: rowData,
      contact,
      contactId: contact?._id || contact?.id,
      phone: getPhone(rowData),
      source: 'google_sheets',
    });
  }

  static async syncRows(workspaceId: string) {
    const integration = await getConnectedIntegration(workspaceId);
    if (!integration) return { processed: 0 };

    const metadata = integration.configMetadata || {};
    const spreadsheetId = metadata.spreadsheetId;
    const sheetName = metadata.sheetName;

    if (!spreadsheetId || !sheetName) {
      await integration.markError('Google Sheets spreadsheet and sheet tab are required.', 'CONFIG_MISSING');
      return { processed: 0 };
    }

    try {
      const rows = await this.fetchAllRows(workspaceId, spreadsheetId, sheetName);
      const lastProcessedRow = Number(metadata.lastProcessedRow || 1);
      const newRows = rows.filter((row) => row.__rowNumber > lastProcessedRow);
      let processed = 0;
      let maxRow = lastProcessedRow;

      for (const row of newRows) {
        maxRow = Math.max(maxRow, row.__rowNumber);
        if (!getPhone(row)) continue;
        await this.processInstantRow(workspaceId, row);
        processed += 1;
      }

      integration.configMetadata = {
        ...metadata,
        lastProcessedRow: rows.length ? Math.max(maxRow, rows[rows.length - 1].__rowNumber) : 1,
        lastSyncRowCount: rows.length,
        lastSyncProcessedCount: processed,
        lastSyncAt: new Date(),
      };
      await integration.markSynced(processed);

      return { processed, totalRows: rows.length };
    } catch (err: any) {
      await integration.markError(err.message, 'SYNC_FAILED');
      throw err;
    }
  }
}
