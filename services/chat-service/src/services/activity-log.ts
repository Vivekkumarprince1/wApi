import { ActivityLog } from '../models/index.js';

type ActivityAction =
  | 'create' | 'read' | 'update' | 'delete' | 'send'
  | 'execute' | 'login' | 'export' | 'import';

/**
 * Port of the monolith activity-logging-service. Fire-and-forget audit trail
 * for workspace mutations — failures never break the main operation. Expects a
 * gateway-authenticated request (req.user / req.workspace populated by the
 * authenticate middleware).
 */
export async function logActivity(
  req: any,
  action: ActivityAction,
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
    if (!req.user?._id || !req.workspace?._id) {
      return;
    }

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
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: (typeof req.get === 'function' && req.get('user-agent')) || 'unknown',
      timestamp: new Date(),
      metadata: options.metadata,
    });
  } catch (err: any) {
    console.error('[ActivityLog] Error logging activity:', err.message);
  }
}
