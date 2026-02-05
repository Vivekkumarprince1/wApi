const { getLogs, exportLogs } = require('../services/auditService');

/**
 * Get audit logs for the current workspace.
 *
 * Query params:
 * - action?: string (filter by action)
 * - userId?: string
 * - startDate?: ISO string
 * - endDate?: ISO string
 * - limit?: number (default 100)
 * - offset?: number (default 0)
 */
async function listAuditLogs(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const {
      action,
      userId,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    const result = await getLogs(workspaceId, {
      action,
      userId,
      startDate,
      endDate,
      limit: Math.min(parseInt(limit, 10) || 100, 1000),
      offset: parseInt(offset, 10) || 0
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Export audit logs for the current workspace.
 *
 * Query params:
 * - format: json | csv (default json)
 */
async function exportAuditLogs(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const format = (req.query.format || 'json').toString().toLowerCase();

    const { format: resolvedFormat, content } = await exportLogs(
      workspaceId,
      format === 'csv' ? 'csv' : 'json'
    );

    if (resolvedFormat === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.send(content);
    }

    return res.json({
      success: true,
      data: content
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAuditLogs,
  exportAuditLogs
};

