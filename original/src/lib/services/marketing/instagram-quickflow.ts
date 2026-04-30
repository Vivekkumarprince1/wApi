/**
 * INSTAGRAM QUICKFLOW SERVICE
 * 
 * Handles Instagram DM keyword triggers and automated responses.
 * NOTE: This is NOT a campaign service — it belongs to the messaging domain.
 */

import { InstagramQuickflow, InstagramQuickflowLog } from '@/lib/models/migrated-models';

export class InstagramQuickflowService {
  /**
   * Process an incoming Instagram DM for keyword triggers
   */
  static async processKeywordTrigger(
    workspaceId: any,
    senderId: string,
    messageText: string,
    accessToken?: string
  ): Promise<void> {
    try {
      if (!messageText || !accessToken) return;

      const quickflows = await InstagramQuickflow.find({
        workspace: workspaceId,
        enabled: true
      }).lean();

      if (!quickflows || quickflows.length === 0) return;

      const lowerText = messageText.toLowerCase().trim();

      for (const flow of quickflows) {
        const keywords = (flow as any).triggerKeywords || [];
        const matched = keywords.some((kw: string) => lowerText.includes(kw.toLowerCase()));

        if (matched) {
          console.log(`[InstagramQuickflow] Keyword match found for workspace ${workspaceId}, sender ${senderId}`);
          
          // Log the match
          await InstagramQuickflowLog.create({
            workspace: workspaceId,
            quickflow: flow._id,
            senderId,
            messageText,
            matchedKeyword: keywords.find((kw: string) => lowerText.includes(kw.toLowerCase())),
            status: 'matched'
          });

          break; // Only process first match
        }
      }
    } catch (err: any) {
      console.error(`[InstagramQuickflow] Error processing keyword trigger:`, err.message);
    }
  }
}
