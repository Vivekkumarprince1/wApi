/**
 * Audit Logging Service
 * Tracks all user actions for compliance and debugging
 */

const AuditLog = require('../models/AuditLog');

function maskPhone(value) {
  const digits = (value || '').toString();
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

function redactPII(value) {
  if (Array.isArray(value)) {
    return value.map(redactPII);
  }
  if (value && typeof value === 'object') {
    const redacted = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      if (['email', 'phone', 'wa_id', 'recipient_id'].includes(lowerKey)) {
        redacted[key] = lowerKey === 'email' ? '[REDACTED]' : maskPhone(val);
        continue;
      }
      if (lowerKey === 'name' || lowerKey === 'profile') {
        redacted[key] = '[REDACTED]';
        continue;
      }
      redacted[key] = redactPII(val);
    }
    return redacted;
  }
  return value;
}

/**
 * Log an action
 * Non-blocking - never fails main flow
 */
async function log(workspaceId, userId, action, resource = null, details = null, req = null) {
  try {
    if (!workspaceId) {
      console.warn('[Audit] workspaceId required');
      return;
    }

    const auditEntry = {
      workspace: workspaceId,
      user: userId || null,
      action,
      resource: resource || null,
      details: details || null,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
      userAgent: req?.headers?.['user-agent'] || 'api',
      createdAt: new Date()
    };

    // Fire and forget - don't await
    AuditLog.create(auditEntry).catch(err => {
      console.error('[Audit] Failed to create log:', err.message);
    });

    const isAdminFailure = /onboarding|token/i.test(action) &&
      (action.includes('fail') || action.includes('error') || details?.error);
    if (isAdminFailure) {
      const adminEntry = {
        ...auditEntry,
        action: `admin.${action}`,
        resource: { type: 'admin', id: workspaceId },
        details: redactPII(details || {})
      };
      AuditLog.create(adminEntry).catch(err => {
        console.error('[Audit] Failed to create admin log:', err.message);
      });
    }

  } catch (err) {
    console.error('[Audit] Unexpected error:', err.message);
    // Never throw - audit is non-critical
  }
}

/**
 * Retrieve audit logs for workspace
 * Used for compliance reviews
 */
async function getLogs(workspaceId, options = {}) {
  try {
    const {
      action = null,
      userId = null,
      startDate = null,
      endDate = null,
      limit = 1000,
      offset = 0
    } = options;

    const query = { workspace: workspaceId };

    if (action) query.action = action;
    if (userId) query.user = userId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await AuditLog.countDocuments(query);

    return { logs, total, limit, offset };
  } catch (err) {
    console.error('[Audit] Query failed:', err.message);
    return { logs: [], total: 0, limit, offset };
  }
}

/**
 * Export logs for compliance review
 */
async function exportLogs(workspaceId, format = 'json') {
  try {
    const logs = await AuditLog
      .find({ workspace: workspaceId })
      .sort({ createdAt: -1 })
      .lean();

    const sanitizedLogs = logs.map(log => ({
      ...log,
      details: redactPII(log.details || {}),
      resource: redactPII(log.resource || {})
    }));

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['Timestamp', 'User', 'Action', 'Resource', 'IP', 'Details'];
      const rows = sanitizedLogs.map(log => [
        log.createdAt.toISOString(),
        log.user || 'system',
        log.action,
        log.resource?.type || '-',
        log.ip,
        JSON.stringify(log.details || {})
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return { format: 'csv', content: csvContent };
    }

    return { format: 'json', content: sanitizedLogs };
  } catch (err) {
    console.error('[Audit] Export failed:', err.message);
    throw err;
  }
}

module.exports = {
  log,
  getLogs,
  exportLogs
};
