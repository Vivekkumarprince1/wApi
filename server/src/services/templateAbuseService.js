const TemplateMetric = require('../models/TemplateMetric');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

/**
 * TEMPLATE ABUSE PREVENTION SERVICE
 * 
 * Risk: If any workspace sends rejected templates repeatedly, Meta throttles entire BSP.
 * Solution: Track rejection rates per workspace + template, auto-flag high-risk workspaces.
 * 
 * Implementation Pattern (Interakt):
 * 1. Log every template create/send attempt
 * 2. Track rejection count per workspace (24h window)
 * 3. Track rejection count per template per workspace
 * 4. Auto-flag workspace when rejection rate > threshold
 * 5. Alert admin, require manual review before resume
 * 
 * Meta Compliance:
 * - Template rejection warnings per workspace (Phase 1)
 * - Auto-ban workspace on 3x Meta suspension (Phase 2)
 */

class TemplateAbuseService {
  /**
   * Record template creation attempt
   * Tracks: workspace, template content hash, creation timestamp
   */
  async recordTemplateCreation(workspaceId, phoneNumberId, templateData) {
    try {
      const contentHash = require('crypto')
        .createHash('md5')
        .update(JSON.stringify(templateData))
        .digest('hex');

      const metric = new TemplateMetric({
        workspaceId,
        phoneNumberId,
        templateName: templateData.name,
        contentHash,
        status: 'created',
        rejectionReason: null,
        retryCount: 0,
        createdAt: new Date(),
      });

      await metric.save();

      await AuditLog.create({
        workspaceId,
        entityType: 'template',
        entityId: templateData.name,
        action: 'create',
        details: {
          phoneNumberId,
          contentHash,
          category: templateData.category || 'MARKETING',
        },
        status: 'success',
      });

      return { success: true, templateName: templateData.name };
    } catch (error) {
      logger.error(`[TemplateAbuseService] recordTemplateCreation failed:`, error);
      throw error;
    }
  }

  /**
   * Record template rejection from Meta
   * Tracks: rejection reason, count, and flags high-risk workspaces
   */
  async recordTemplateRejection(workspaceId, templateName, rejectionReason) {
    try {
      // Update metric with rejection
      const metric = await TemplateMetric.findOneAndUpdate(
        { workspaceId, templateName, status: 'created' },
        {
          $set: { status: 'rejected', rejectionReason },
          $inc: { retryCount: 1 },
        },
        { new: true }
      );

      if (!metric) {
        logger.warn(`[TemplateAbuseService] Template not found for update:`, {
          workspaceId,
          templateName,
        });
        return;
      }

      // Log audit trail
      await AuditLog.create({
        workspaceId,
        entityType: 'template',
        entityId: templateName,
        action: 'reject',
        details: {
          reason: rejectionReason,
          retryCount: metric.retryCount,
        },
        status: 'warning',
      });

      // Check if workspace exceeds abuse threshold
      await this._checkAbuseThreshold(workspaceId);

      return { success: true, retryCount: metric.retryCount };
    } catch (error) {
      logger.error(`[TemplateAbuseService] recordTemplateRejection failed:`, error);
      throw error;
    }
  }

  /**
   * Record successful template approval
   */
  async recordTemplateApproval(workspaceId, templateName) {
    try {
      await TemplateMetric.findOneAndUpdate(
        { workspaceId, templateName },
        { $set: { status: 'approved', approvedAt: new Date() } },
        { new: true }
      );

      await AuditLog.create({
        workspaceId,
        entityType: 'template',
        entityId: templateName,
        action: 'approve',
        details: {},
        status: 'success',
      });

      return { success: true };
    } catch (error) {
      logger.error(`[TemplateAbuseService] recordTemplateApproval failed:`, error);
      throw error;
    }
  }

  /**
   * Get rejection metrics for workspace
   * Returns: rejection rate, high-risk templates, suspension risk score
   */
  async getWorkspaceMetrics(workspaceId, timeWindowDays = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

      const metrics = await TemplateMetric.find({
        workspaceId,
        createdAt: { $gte: cutoffDate },
      });

      // Calculate rejection rate
      const rejected = metrics.filter((m) => m.status === 'rejected').length;
      const total = metrics.length;
      const rejectionRate = total > 0 ? (rejected / total) * 100 : 0;

      // Find high-risk templates (>3 rejections)
      const templateRejections = {};
      metrics.forEach((m) => {
        if (m.status === 'rejected') {
          templateRejections[m.templateName] =
            (templateRejections[m.templateName] || 0) + 1;
        }
      });

      const highRiskTemplates = Object.entries(templateRejections)
        .filter(([_, count]) => count > 3)
        .map(([name, count]) => ({ name, rejectionCount: count }));

      // Calculate suspension risk (Meta throttles at 30%+ rejection rate)
      const suspensionRisk = rejectionRate > 30 ? 'HIGH' : rejectionRate > 15 ? 'MEDIUM' : 'LOW';

      return {
        timeWindow: `${timeWindowDays}d`,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        totalTemplates: total,
        rejectedTemplates: rejected,
        approvedTemplates: metrics.filter((m) => m.status === 'approved').length,
        suspensionRisk,
        highRiskTemplates,
        recommendations:
          rejectionRate > 20
            ? 'Reduce template submission rate, review rejection reasons'
            : 'Normal activity',
      };
    } catch (error) {
      logger.error(`[TemplateAbuseService] getWorkspaceMetrics failed:`, error);
      throw error;
    }
  }

  /**
   * List templates pending approval (not yet rejected/approved)
   */
  async getPendingTemplates(workspaceId, limit = 50) {
    try {
      const pending = await TemplateMetric.find({
        workspaceId,
        status: 'created',
      })
        .sort({ createdAt: -1 })
        .limit(limit);

      return pending;
    } catch (error) {
      logger.error(`[TemplateAbuseService] getPendingTemplates failed:`, error);
      throw error;
    }
  }

  /**
   * List rejected templates with reasons
   */
  async getRejectedTemplates(workspaceId, limit = 50) {
    try {
      const rejected = await TemplateMetric.find({
        workspaceId,
        status: 'rejected',
      })
        .sort({ createdAt: -1 })
        .limit(limit);

      return rejected;
    } catch (error) {
      logger.error(`[TemplateAbuseService] getRejectedTemplates failed:`, error);
      throw error;
    }
  }

  /**
   * INTERNAL: Check if workspace exceeds abuse threshold
   * Triggers: Auto-flag, alert, and suspension warning
   */
  async _checkAbuseThreshold(workspaceId) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 1); // 24h window

      const metrics24h = await TemplateMetric.find({
        workspaceId,
        createdAt: { $gte: cutoffDate },
      });

      const rejected24h = metrics24h.filter((m) => m.status === 'rejected').length;
      const total24h = metrics24h.length;
      const rejectionRate24h = total24h > 0 ? (rejected24h / total24h) * 100 : 0;

      // Threshold: 5 rejections in 24h OR >50% rejection rate in 24h
      if (rejected24h >= 5 || rejectionRate24h > 50) {
        await AuditLog.create({
          workspaceId,
          entityType: 'workspace',
          entityId: workspaceId,
          action: 'abuse_flag',
          details: {
            rejections24h: rejected24h,
            total24h,
            rejectionRate: rejectionRate24h,
            threshold: 'EXCEEDED',
          },
          status: 'critical',
        });

        logger.error(`[TemplateAbuseService] ABUSE DETECTED:`, {
          workspaceId,
          rejected24h,
          rejectionRate: rejectionRate24h,
          action: 'WORKSPACE_FLAGGED',
        });

        // TODO: Alert admin dashboard
        // TODO: Send workspace owner email warning
      }
    } catch (error) {
      logger.error(`[TemplateAbuseService] _checkAbuseThreshold failed:`, error);
    }
  }
}

module.exports = new TemplateAbuseService();
