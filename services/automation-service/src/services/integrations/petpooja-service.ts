import axios from 'axios';
import { Integration } from '../../models';

export class PetpoojaService {
  private static BASE_URL = 'https://developerapi.petpooja.com/v2';

  /**
   * Fetch recent orders for a workspace's Petpooja integration
   */
  static async syncOrders(workspaceId: string) {
    const integration = await (Integration as any).findOne({ 
      workspace: workspaceId, 
      type: 'petpooja', 
      status: 'connected' 
    }).select('+config');


    if (!integration) return;

    const config = (integration as any).getDecryptedConfig();
    const { vendorId, apiKey } = config;

    const formatDate = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    try {
      const fromDate = integration.lastSyncAt 
        ? formatDate(integration.lastSyncAt) 
        : formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

      const response = await axios.get(`${this.BASE_URL}/orders`, {
        headers: {
          'api-key': apiKey,
          'vendor-id': vendorId
        },
        params: {
          from_date: fromDate
        }
      });

      const orders = response.data?.orders || [];
      
      // Trigger automation flow locally/stub
      console.log(`[PetpoojaService] Syncing ${orders.length} orders for Workspace ${workspaceId}`);

      await (integration as any).markSynced(orders.length);
      console.log(`[PetpoojaService] Sync complete for workspace ${workspaceId}: ${orders.length} orders found.`);
      
    } catch (error: any) {
      console.error(`[PetpoojaService] Sync failed for workspace ${workspaceId}:`, error.message);
      await (integration as any).markError(error.message, 'SYNC_FAILED');
    }
  }

  /**
   * Validate credentials during onboarding
   */
  static async validateCredentials(vendorId: string, apiKey: string) {
    try {
      await axios.get(`${this.BASE_URL}/restaurants`, {
        headers: {
          'api-key': apiKey,
          'vendor-id': vendorId
        }
      });
      return true;
    } catch (err) {
      return false;
    }
  }
}
