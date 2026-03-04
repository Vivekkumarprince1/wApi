/**
 * Automation Controller - Stage 6
 * 
 * API endpoints for automation rule management and monitoring:
 * - Rule CRUD
 * - Enable/disable rules
 * - View execution logs
 * - Test rules (dry-run)
 * - Kill-switch control
 */

const { AutomationRule, AutomationExecution, AutomationAuditLog } = require('../../models');
const automationEngine = require('../../services/automation/automationEngine');
const logger = require('../../utils/logger');

