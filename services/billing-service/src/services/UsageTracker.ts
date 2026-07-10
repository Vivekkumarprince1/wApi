import mongoose, { Types } from 'mongoose';

export type UsageResource = 'contacts' | 'messages' | 'templates' | 'campaigns' | 'automations' | 'deals' | 'products';

export class UsageTracker {
  /**
   * Increments usage for a specific resource in the shared workspaces collection.
   * Reuses the existing mongoose connection, dynamically switching to the 'connectsphere' database context.
   */
  static async increment(
    workspaceId: string | Types.ObjectId, 
    resource: UsageResource, 
    amount: number = 1
  ) {
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
      const db = mongoose.connection.useDb('connectsphere');
      const result = await db.collection('workspaces').findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(String(workspaceId)) },
        { 
          $inc: { 
            [field]: amount,
            [`usage.${resource}Daily`]: amount
          } 
        },
        { returnDocument: 'after' }
      );
      
      return result?.usage;
    } catch (error: any) {
      console.error(`[UsageTracker] Increment failed: ${resource}`, error.message);
      throw error;
    }
  }
}
