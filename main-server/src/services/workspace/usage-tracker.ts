/**
 * USAGE TRACKER SERVICE
 * 
 * Centralized logic for incrementing workspace usage metrics and 
 * ensuring data consistency with the plan limits.
 */

import { Workspace } from "@/models";
import dbConnect from "@/db-connect";
import mongoose, { Types } from "mongoose";

export type UsageResource = 'contacts' | 'messages' | 'templates' | 'campaigns' | 'automations' | 'deals' | 'products';

export class UsageTracker {
  
  /**
   * Increments usage for a specific resource
   * @param workspaceId ID of the workspace
   * @param resource Resource key to increment
   * @param amount Amount to increment by (default 1)
   */
  static async increment(
    workspaceId: string | Types.ObjectId, 
    resource: UsageResource, 
    amount: number = 1
  ) {
    await dbConnect();
    
    // Map resource to schema fields
    const fieldMap: Record<UsageResource, string> = {
      contacts: 'usage.contacts',
      messages: 'usage.messagesThisMonth',
      templates: 'usage.templates',
      campaigns: 'usage.campaigns',
      automations: 'usage.automations',
      deals: 'usage.deals',
      products: 'usage.products'
    };

    const field = fieldMap[resource];
    if (!field) throw new Error(`INVALID_RESOURCE: ${resource}`);

    try {
      // Atomic increment
      const workspace = await Workspace.findByIdAndUpdate(
        workspaceId,
        { 
          $inc: { 
            [field]: amount,
            [`usage.${resource}Daily`]: amount // Also track daily if fields exist (some might not)
          } 
        },
        { returnDocument: 'after' }
      );

      return workspace?.usage;
    } catch (error: any) {
      console.error(`[UsageTracker] Increment failed: ${resource}`, error.message);
      throw error;
    }
  }

  /**
   * Resets monthly message counters
   * Should be called by a cron job or during billing cycle start
   */
  static async resetMonthlyUsage(workspaceId: string | Types.ObjectId) {
    await dbConnect();
    return await Workspace.findByIdAndUpdate(workspaceId, {
      $set: { 'usage.messagesThisMonth': 0 }
    });
  }

  /**
   * Syncs usage by actually counting documents (Recovery/Audit only)
   * Expensive operation - use sparingly
   */
  static async syncFromDatabase(workspaceId: string | Types.ObjectId) {
    await dbConnect();
    // Implementation would involve counting from Message, Contact, Deal models
    // For now, we trust the incremental counters
  }
}
