import { Segment } from '../models';
import { monolithWorkerBridge } from '../lib/monolith-worker-client';
import { Types } from 'mongoose';

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

    if (filters?.tags?.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters?.notTags?.length > 0) {
      query.tags = { ...(query.tags || {}), $nin: filters.notTags };
    }

    if (filters?.leadStatus) {
      query.leadStatus = filters.leadStatus;
    }

    if (filters?.customQuery) {
      Object.assign(query, filters.customQuery);
    }

    const { contacts } = await monolithWorkerBridge.queryContacts(query);
    return contacts as Types.ObjectId[];
  }

  /**
   * Get total contact count for a specific filter
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

    const { count } = await monolithWorkerBridge.countContacts(query);
    return count;
  }
}
