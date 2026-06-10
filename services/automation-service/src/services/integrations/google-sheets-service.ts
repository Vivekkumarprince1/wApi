/**
 * GOOGLE SHEETS SERVICE (MOCK MODE)
 */
export class GoogleSheetsService {
  static async syncRows(workspaceId: string) {
    console.warn("[GoogleSheets:Mock] Sync skipped - dependencies missing");
  }

  static async processInstantRow(workspaceId: string, rowData: any) {
    console.warn("[GoogleSheets:Mock] Instant process skipped - dependencies missing");
  }

  static async fetchAllRows(workspaceId: string, spreadsheetId: string, sheetName: string) {
    throw new Error("GOOGLE_SHEETS_SERVICE_MOCK_MODE");
  }

  static async getColumns(workspaceId: string, spreadsheetId: string, sheetName: string) {
    throw new Error("GOOGLE_SHEETS_SERVICE_MOCK_MODE");
  }

  static async listSpreadsheets(integration: any) {
    return [];
  }
}
