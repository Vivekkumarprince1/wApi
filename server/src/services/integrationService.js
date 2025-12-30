const Integration = require('../models/Integration');
const Workspace = require('../models/Workspace');

/**
 * Integration Service - Business logic for integrations
 * 
 * Handles:
 * - CRUD operations on integrations
 * - Configuration validation
 * - Plan permission checks
 * - Sync operations
 * - Error tracking
 */

class IntegrationService {
  /**
   * Get all integrations for workspace
   */
  static async getIntegrations(workspaceId, filters = {}) {
    try {
      const query = { workspace: workspaceId };

      if (filters.type) {
        query.type = filters.type;
      }
      if (filters.status) {
        query.status = filters.status;
      }

      const integrations = await Integration.find(query)
        .select('-config') // Never return encrypted config
        .sort({ createdAt: -1 })
        .lean();

      return integrations;
    } catch (err) {
      throw new Error(`Failed to fetch integrations: ${err.message}`);
    }
  }

  /**
   * Get single integration (with decrypted config if authorized)
   */
  static async getIntegration(integrationId, workspaceId, includeConfig = false) {
    try {
      const integration = await Integration.findOne({
        _id: integrationId,
        workspace: workspaceId
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      if (includeConfig) {
        // Only return to authorized users
        const decrypted = integration.getDecryptedConfig();
        return {
          ...integration.toObject(),
          config: decrypted
        };
      }

      return integration.toSafeJSON();
    } catch (err) {
      throw new Error(`Failed to fetch integration: ${err.message}`);
    }
  }

  /**
   * Check if workspace can use specific integration type
   * Based on plan limits
   */
  static async canUseIntegrationType(workspaceId, integrationType) {
    try {
      const workspace = await Workspace.findById(workspaceId);

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const planPermissions = {
        webhook: ['free', 'basic', 'premium', 'enterprise'],
        google_sheets: ['premium', 'enterprise'],
        zapier: ['enterprise'],
        payment: ['basic', 'premium', 'enterprise'],
        crm: ['premium', 'enterprise'],
        instagram: ['basic', 'premium', 'enterprise'],
        email: ['basic', 'premium', 'enterprise'],
        sms: ['basic', 'premium', 'enterprise'],
        openai: ['premium', 'enterprise'],
        custom: ['enterprise']
      };

      const allowedPlans = planPermissions[integrationType];

      if (!allowedPlans) {
        throw new Error(`Unknown integration type: ${integrationType}`);
      }

      const canUse = allowedPlans.includes(workspace.plan);

      return {
        canUse,
        plan: workspace.plan,
        allowedPlans,
        reason: !canUse
          ? `${integrationType} integration requires ${allowedPlans.join(' or ')} plan`
          : null
      };
    } catch (err) {
      throw new Error(`Permission check failed: ${err.message}`);
    }
  }

  /**
   * Create new integration
   */
  static async createIntegration(workspaceId, data, userId) {
    try {
      const { type, name, description, config, syncInterval, syncDirection } = data;

      // Check plan permissions
      const permission = await this.canUseIntegrationType(workspaceId, type);
      if (!permission.canUse) {
        throw new Error(permission.reason);
      }

      // Validate config
      const tempIntegration = new Integration({
        workspace: workspaceId,
        type,
        name,
        description,
        syncInterval: syncInterval || 0,
        syncDirection: syncDirection || 'push',
        createdBy: userId
      });

      // Encrypt and set config
      tempIntegration.setEncryptedConfig(config);

      // Validate
      const validation = tempIntegration.validateConfig();
      if (!validation.valid) {
        throw new Error(`Config validation failed: ${validation.errors.join(', ')}`);
      }

      // Store metadata (non-secret parts)
      tempIntegration.configMetadata = this.extractMetadata(type, config);

      // Save
      await tempIntegration.save();

      return tempIntegration.toSafeJSON();
    } catch (err) {
      throw new Error(`Failed to create integration: ${err.message}`);
    }
  }

  /**
   * Update integration
   */
  static async updateIntegration(integrationId, workspaceId, data, userId) {
    try {
      const integration = await Integration.findOne({
        _id: integrationId,
        workspace: workspaceId
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      // Update allowed fields
      const { name, description, config, syncInterval, syncDirection, status } = data;

      if (name) integration.name = name;
      if (description) integration.description = description;
      if (syncInterval !== undefined) integration.syncInterval = syncInterval;
      if (syncDirection) integration.syncDirection = syncDirection;

      // If config changed, re-encrypt and validate
      if (config) {
        integration.setEncryptedConfig(config);
        const validation = integration.validateConfig();
        if (!validation.valid) {
          throw new Error(`Config validation failed: ${validation.errors.join(', ')}`);
        }
        integration.configMetadata = this.extractMetadata(integration.type, config);
      }

      if (status && ['connected', 'disconnected', 'error', 'pending'].includes(status)) {
        integration.status = status;
      }

      integration.updatedBy = userId;
      await integration.save();

      return integration.toSafeJSON();
    } catch (err) {
      throw new Error(`Failed to update integration: ${err.message}`);
    }
  }

  /**
   * Delete integration
   */
  static async deleteIntegration(integrationId, workspaceId) {
    try {
      const result = await Integration.deleteOne({
        _id: integrationId,
        workspace: workspaceId
      });

      if (result.deletedCount === 0) {
        throw new Error('Integration not found');
      }

      return { success: true, message: 'Integration deleted' };
    } catch (err) {
      throw new Error(`Failed to delete integration: ${err.message}`);
    }
  }

  /**
   * Test integration connection
   * Validates config without storing
   */
  static async testIntegration(workspaceId, type, config) {
    try {
      // Create temp integration for validation
      const tempIntegration = new Integration({
        workspace: workspaceId,
        type,
        name: 'Test',
        createdBy: null
      });

      tempIntegration.setEncryptedConfig(config);

      // Validate config structure
      const validation = tempIntegration.validateConfig();
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Run type-specific tests
      const decryptedConfig = tempIntegration.getDecryptedConfig();
      let typeSpecificTest = { success: true };

      switch (type) {
        case 'webhook':
          typeSpecificTest = await this.testWebhookConfig(decryptedConfig);
          break;

        case 'google_sheets':
          typeSpecificTest = await this.testGoogleSheetsConfig(decryptedConfig);
          break;

        case 'zapier':
          typeSpecificTest = await this.testZapierConfig(decryptedConfig);
          break;

        case 'payment':
          typeSpecificTest = await this.testPaymentConfig(decryptedConfig);
          break;

        case 'crm':
          typeSpecificTest = await this.testCRMConfig(decryptedConfig);
          break;

        case 'email':
          typeSpecificTest = await this.testEmailConfig(decryptedConfig);
          break;

        case 'sms':
          typeSpecificTest = await this.testSMSConfig(decryptedConfig);
          break;

        case 'openai':
          typeSpecificTest = await this.testOpenAIConfig(decryptedConfig);
          break;

        default:
          typeSpecificTest = { success: true };
      }

      return typeSpecificTest;
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Mark integration as synced
   */
  static async markSynced(integrationId, recordsCount = 0) {
    try {
      const integration = await Integration.findById(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      await integration.markSynced(recordsCount);
      return integration.toSafeJSON();
    } catch (err) {
      throw new Error(`Failed to mark synced: ${err.message}`);
    }
  }

  /**
   * Mark integration as error
   */
  static async markError(integrationId, errorMessage, errorCode = 'SYNC_ERROR') {
    try {
      const integration = await Integration.findById(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      await integration.markError(errorMessage, errorCode);
      return integration.toSafeJSON();
    } catch (err) {
      throw new Error(`Failed to mark error: ${err.message}`);
    }
  }

  /**
   * Get integrations due for sync
   */
  static async getIntegrationsDueForSync(limit = 100) {
    try {
      const now = new Date();

      const integrations = await Integration.find({
        status: 'connected',
        syncInterval: { $gt: 0 },
        $or: [
          { nextSyncAt: { $lte: now } },
          { nextSyncAt: null, lastSyncAt: null }
        ]
      })
        .select('-config')
        .limit(limit);

      return integrations;
    } catch (err) {
      throw new Error(`Failed to get sync queue: ${err.message}`);
    }
  }

  /**
   * Extract non-secret metadata from config
   */
  static extractMetadata(type, config) {
    const metadata = {};

    switch (type) {
      case 'webhook':
        metadata.url = config.url ? '***' : undefined;
        metadata.events = config.events || [];
        metadata.isActive = config.isActive !== false;
        break;

      case 'google_sheets':
        metadata.spreadsheetId = config.spreadsheetId ? '***' : undefined;
        metadata.sheetName = config.sheetName;
        break;

      case 'zapier':
        metadata.webhookUrl = config.webhookUrl ? '***' : undefined;
        break;

      case 'payment':
        metadata.provider = config.provider;
        metadata.hasAPIKey = !!config.apiKey;
        break;

      case 'crm':
        metadata.provider = config.provider;
        metadata.hasAPIKey = !!config.apiKey;
        break;

      case 'email':
        metadata.provider = config.provider;
        metadata.hasAPIKey = !!config.apiKey;
        break;

      case 'sms':
        metadata.provider = config.provider;
        metadata.fromNumber = config.fromNumber;
        break;

      case 'openai':
        metadata.hasAPIKey = !!config.apiKey;
        break;

      default:
        break;
    }

    return metadata;
  }

  // =========================================================================
  // TYPE-SPECIFIC CONNECTION TESTS
  // =========================================================================

  static async testWebhookConfig(config) {
    try {
      // Validate URL format
      if (!config.url.startsWith('http')) {
        return { success: false, error: 'Invalid webhook URL' };
      }

      // Try to reach the webhook
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });

      return {
        success: response.ok,
        statusCode: response.status,
        message: response.ok ? 'Webhook is reachable' : 'Webhook returned error'
      };
    } catch (err) {
      return {
        success: false,
        error: `Webhook test failed: ${err.message}`
      };
    }
  }

  static async testGoogleSheetsConfig(config) {
    try {
      // This would use Google Sheets API client
      // Placeholder for real implementation
      if (!config.accessToken || !config.spreadsheetId) {
        return { success: false, error: 'Missing credentials' };
      }

      return {
        success: true,
        message: 'Google Sheets configuration valid'
      };
    } catch (err) {
      return {
        success: false,
        error: `Google Sheets test failed: ${err.message}`
      };
    }
  }

  static async testZapierConfig(config) {
    try {
      if (!config.webhookUrl) {
        return { success: false, error: 'Missing webhook URL' };
      }

      return {
        success: true,
        message: 'Zapier configuration valid'
      };
    } catch (err) {
      return {
        success: false,
        error: `Zapier test failed: ${err.message}`
      };
    }
  }

  static async testPaymentConfig(config) {
    try {
      if (!config.provider || !config.apiKey) {
        return { success: false, error: 'Missing provider or API key' };
      }

      // Provider-specific validation
      const validProviders = ['razorpay', 'stripe', 'paypal', 'square'];
      if (!validProviders.includes(config.provider.toLowerCase())) {
        return { success: false, error: `Unknown provider: ${config.provider}` };
      }

      return {
        success: true,
        message: `${config.provider} configuration valid`
      };
    } catch (err) {
      return {
        success: false,
        error: `Payment test failed: ${err.message}`
      };
    }
  }

  static async testCRMConfig(config) {
    try {
      const validProviders = ['salesforce', 'hubspot', 'pipedrive', 'zoho'];
      if (!validProviders.includes(config.provider?.toLowerCase())) {
        return { success: false, error: `Unknown CRM: ${config.provider}` };
      }

      return {
        success: true,
        message: `${config.provider} CRM configuration valid`
      };
    } catch (err) {
      return {
        success: false,
        error: `CRM test failed: ${err.message}`
      };
    }
  }

  static async testEmailConfig(config) {
    try {
      const validProviders = ['sendgrid', 'mailgun', 'ses', 'smtp'];
      if (!validProviders.includes(config.provider?.toLowerCase())) {
        return { success: false, error: `Unknown email provider: ${config.provider}` };
      }

      return {
        success: true,
        message: `${config.provider} email configuration valid`
      };
    } catch (err) {
      return {
        success: false,
        error: `Email test failed: ${err.message}`
      };
    }
  }

  static async testSMSConfig(config) {
    try {
      const validProviders = ['twilio', 'nexmo', 'sns'];
      if (!validProviders.includes(config.provider?.toLowerCase())) {
        return { success: false, error: `Unknown SMS provider: ${config.provider}` };
      }

      if (!config.fromNumber) {
        return { success: false, error: 'From number required' };
      }

      return {
        success: true,
        message: `${config.provider} SMS configuration valid`
      };
    } catch (err) {
      return {
        success: false,
        error: `SMS test failed: ${err.message}`
      };
    }
  }

  static async testOpenAIConfig(config) {
    try {
      if (!config.apiKey) {
        return { success: false, error: 'API key required' };
      }

      // Would validate against OpenAI API
      return {
        success: true,
        message: 'OpenAI configuration valid'
      };
    } catch (err) {
      return {
        success: false,
        error: `OpenAI test failed: ${err.message}`
      };
    }
  }
}

module.exports = IntegrationService;
