const { Workspace } = require('../../models');
const bspMessagingService = require('../../services/bsp/bspMessagingService');

/**
 * Public Endpoint: Send WhatsApp Authentication (OTP) Message
 * Authenticated via 'x-api-key' header
 */
exports.sendOtp = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    let { phoneNumber, templateName, components, variables, languageCode = 'en' } = req.body;

    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key is missing' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'phoneNumber is required' });
    }

    // Find workspace by API key (check within the apiKeys array)
    const workspace = await Workspace.findOne({
      'apiKeys': {
        $elemMatch: {
          key: apiKey,
          isActive: true
        }
      }
    });

    if (!workspace) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive API key' });
    }

    // Find the specific key details from the array
    const keyDetails = workspace.apiKeys.find(k => k.key === apiKey);
    
    // Fallback to key-specific template if not provided in request
    const finalTemplateName = templateName || keyDetails?.templateName;

    if (!finalTemplateName) {
      return res.status(400).json({ 
        success: false, 
        message: 'templateName is required (none configured in dashboard)' 
      });
    }

    console.log(`[ExternalAPI] Sending OTP for workspace ${workspace._id} to ${phoneNumber} using template ${finalTemplateName}`);

    // Send Template Message
    let finalComponents = components || [];
    if (variables && Array.isArray(variables) && finalComponents.length === 0) {
      finalComponents = [
        {
          type: 'body',
          parameters: variables.map(v => ({ type: 'text', text: String(v) }))
        }
      ];
    }

    try {
      const result = await bspMessagingService.sendTemplateMessage(
        workspace._id,
        phoneNumber,
        finalTemplateName, // Fix: use finalTemplateName instead of templateName
        languageCode,
        finalComponents,
        { 
          source: 'API_EXTERNAL', // Track source for analytics
          isOtp: true 
        }
      );

      return res.json({
        success: true,
        messageId: result.messageId,
        message: 'OTP message sent successfully'
      });
    } catch (messagingError) {
      console.error(`[ExternalAPI] Messaging error:`, messagingError.message);
      return res.status(400).json({ 
        success: false, 
        message: messagingError.message 
      });
    }
  } catch (error) {
    console.error('[ExternalAPI] Critical error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
