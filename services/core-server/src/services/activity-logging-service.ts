/**
 * Activity Logging Service
 * Centralized service to log all user actions and mutations
 */

import { Request } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { AuthRequest } from '../middlewares/authMiddleware';

/**
 * Log a user activity
 */
export async function logActivity(
  req: AuthRequest,
  action: 'create' | 'read' | 'update' | 'delete' | 'send' | 'execute' | 'login' | 'export' | 'import',
  entityType: string,
  options: {
    entityId?: string;
    entityName?: string;
    changes?: { before?: any; after?: any };
    status?: 'success' | 'failed';
    errorDetails?: string;
    metadata?: any;
  } = {}
) {
  try {
    if (!req.user || !req.workspace) {
      console.warn('[ActivityLog] Missing user or workspace context');
      return;
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    await ActivityLog.create({
      workspace: req.workspace._id,
      user: req.user._id,
      action,
      entityType,
      entityId: options.entityId,
      entityName: options.entityName,
      changes: options.changes,
      status: options.status || 'success',
      errorDetails: options.errorDetails,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      metadata: options.metadata
    });
  } catch (err: any) {
    console.error('[ActivityLog] Error logging activity:', err.message);
    // Don't throw - logging failures shouldn't break main operations
  }
}

/**
 * Log bulk activity
 */
export async function logBulkActivity(
  req: AuthRequest,
  action: string,
  entityType: string,
  count: number,
  options: any = {}
) {
  return logActivity(req, action as any, entityType, {
    ...options,
    metadata: {
      ...options.metadata,
      bulkCount: count
    }
  });
}

/**
 * Get activity logs for workspace
 */
export async function getActivityLogs(
  workspaceId: string,
  filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const query: any = { workspace: workspaceId };

  if (filters.userId) query.user = filters.userId;
  if (filters.action) query.action = filters.action;
  if (filters.entityType) query.entityType = filters.entityType;

  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = filters.startDate;
    if (filters.endDate) query.timestamp.$lte = filters.endDate;
  }

  const total = await ActivityLog.countDocuments(query);
  const logs = await ActivityLog.find(query)
    .populate('user', 'name email avatar')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get activity summary
 */
export async function getActivitySummary(
  workspaceId: string,
  days: number = 7
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const summary = await ActivityLog.aggregate([
    {
      $match: {
        workspace: require('mongoose').Types.ObjectId.createFromHexString(workspaceId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  return summary;
}

/**
 * Get user activity timeline
 */
export async function getUserActivityTimeline(
  workspaceId: string,
  userId: string,
  limit: number = 20
) {
  return ActivityLog.find({
    workspace: workspaceId,
    user: userId
  })
    .select('action entityType entityName timestamp status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
}

/**
 * Delete old activity logs (older than days)
 */
export async function cleanupOldActivityLogs(workspaceId: string, days: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await ActivityLog.deleteMany({
    workspace: workspaceId,
    timestamp: { $lt: cutoffDate }
  });

  return result;
}

/**
 * Compare objects and return differences
 */
export function getDifferences(before: any, after: any): any {
  const changes: any = {};

  if (!before) {
    return { added: after };
  }

  if (!after) {
    return { removed: before };
  }

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before[key];
    const afterValue = after[key];

    // Skip if values are the same
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue;
    }

    // Skip internal/system fields
    if (['_id', 'createdAt', 'updatedAt', '__v'].includes(key)) {
      continue;
    }

    changes[key] = {
      before: beforeValue,
      after: afterValue
    };
  }

  return changes;
}
