/**
 * SEGMENT SERVICE
 * 
 * Handles dynamic contact resolution from Segments and recipient filters.
 * Port of legacy segmentService.js
 */

import { Segment } from "@/lib/models/campaign/Segment";
import { Contact } from "@/lib/models/messaging/Contact";
import { Types } from "mongoose";

export class SegmentService {
  /**
   * Resolve a segment into a list of contact IDs
   */
  static async resolveSegmentContacts(workspaceId: string | Types.ObjectId, segmentId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const segment = await Segment.findOne({ _id: segmentId, workspace: workspaceId }).lean();
    if (!segment) return [];

    return this.resolveByFilters(workspaceId, segment.filters);
  }

  /**
   * Resolve a raw filter object into contact IDs
   */
  static async resolveByFilters(workspaceId: string | Types.ObjectId, filters: any): Promise<Types.ObjectId[]> {
    const query: any = { 
       workspace: new Types.ObjectId(workspaceId as string),
       'optOut.status': { $ne: true } 
    };

    // 1. Tag Filtering
    if (filters?.tags?.length > 0) {
      query.tags = { $in: filters.tags };
    }

    // 2. Exclusion Filtering
    if (filters?.notTags?.length > 0) {
      query.tags = { ...(query.tags || {}), $nin: filters.notTags };
    }

    // 3. Status Filtering
    if (filters?.leadStatus) {
      query.leadStatus = filters.leadStatus;
    }

    // 4. Custom Mongoose Query (Restricted/Sanitized)
    if (filters?.customQuery) {
      Object.assign(query, filters.customQuery);
    }

    const contacts = await Contact.find(query).distinct('_id');
    return contacts as Types.ObjectId[];
  }

  /**
   * Get total contact count for a specific filter (used for UI estimation)
   */
  static async getSegmentCount(workspaceId: string | Types.ObjectId, filters: any): Promise<number> {
    const query: any = { 
      workspace: new Types.ObjectId(workspaceId as string),
      'optOut.status': { $ne: true } 
   };

    if (filters?.tags?.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters?.notTags?.length > 0) {
      query.tags = { ...(query.tags || {}), $nin: filters.notTags };
    }

    return await Contact.countDocuments(query);
  }
}
