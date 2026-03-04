/**
 * Automation Controller - Stage 6 Automation Engine
 * 
 * API endpoints for:
 * - Rule CRUD
 * - Execution logs
 * - Testing/dry-run
 * - Engine control
 */

const { AutomationRule, AutomationExecution } = require('../../models');
const automationEngine = require('../../services/automation/automationEngine');
const safetyGuards = require('../../services/automation/automationSafetyGuards');
const { automationEvents } = require('../../services/automation/automationEventEmitter');
const logger = require('../../utils/logger');

