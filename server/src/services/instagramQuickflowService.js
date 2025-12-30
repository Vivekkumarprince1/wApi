const InstagramQuickflow = require('../models/InstagramQuickflow');
const InstagramQuickflowLog = require('../models/InstagramQuickflowLog');
const Workspace = require('../models/Workspace');
const axios = require('axios');

/**
 * Check if incoming Instagram event matches any quickflow
 * Returns matching quickflow and eligibility status
 */
async function checkInstagramQuickflow(
  instagramUserId,
  instagramUsername,
  triggerType,
  triggerContent,
  workspace
) {
  try {
    // Get all enabled quickflows for this workspace with this trigger type
    const quickflows = await InstagramQuickflow.find({
      workspace,
      enabled: true,
      triggerType
    }).populate('template');

    for (const qf of quickflows) {
      // Check keyword match
      if (!matchKeywords(triggerContent, qf.keywords, qf.matchMode)) {
        continue;
      }

      // Check 24h window
      if (qf.rateLimitEnabled) {
        const hoursSinceLastTrigger = await checkInstagramQuickflowWindow(
          workspace,
          qf._id,
          instagramUserId,
          qf.rateLimitWindow
        );

        if (hoursSinceLastTrigger < qf.rateLimitWindow) {
          // Within rate limit window, skip
          continue;
        }
      }

      // All checks passed
      return {
        shouldSend: true,
        quickflowId: qf._id,
        quickflowData: qf,
        triggerType
      };
    }

    return { shouldSend: false };
  } catch (err) {
    console.error('Error checking Instagram quickflow:', err);
    return { shouldSend: false };
  }
}

/**
 * Check if contact is within rate limit window
 * Returns hours since last trigger
 */
async function checkInstagramQuickflowWindow(
  workspace,
  quickflowId,
  instagramUserId,
  limitWindow
) {
  try {
    const lastLog = await InstagramQuickflowLog.findOne({
      workspace,
      quickflow: quickflowId,
      instagramUserId,
      responseSent: true
    }).sort({ triggeredAt: -1 });

    if (!lastLog) {
      return limitWindow + 1; // No previous trigger
    }

    const hoursSince = (Date.now() - lastLog.triggeredAt) / (1000 * 60 * 60);
    return hoursSince;
  } catch (err) {
    console.error('Error checking quickflow window:', err);
    return limitWindow + 1; // Fallback: allow sending
  }
}

/**
 * Send Instagram quickflow response
 */
async function sendInstagramQuickflowResponse(
  quickflow,
  instagramUserId,
  instagramUsername,
  triggerType,
  triggerContent,
  workspace,
  metaAccessToken
) {
  try {
    let responseContent = '';
    let responseSent = false;
    let responseId = null;

    // Build response based on quickflow configuration
    if (quickflow.response.message) {
      responseContent = quickflow.response.message;
    } else if (quickflow.response.template) {
      // Use template
      responseContent = `[Template: ${quickflow.response.template.name}]`;
    }

    // Send response via Instagram API
    if (responseContent) {
      try {
        // Send DM via Instagram API
        const metaGraphUrl = 'https://graph.instagram.com/v21.0';
        const response = await axios.post(
          `${metaGraphUrl}/${workspace.instagramConfig.accountId}/messages`,
          {
            recipient: {
              id: instagramUserId
            },
            message: {
              text: responseContent
            }
          },
          {
            headers: {
              Authorization: `Bearer ${metaAccessToken}`
            }
          }
        );

        responseId = response.data.message_id;
        responseSent = true;
      } catch (apiErr) {
        console.error('Error sending Instagram response:', apiErr.message);
        responseSent = false;
      }
    }

    // Create log entry for rate limiting
    await InstagramQuickflowLog.create({
      workspace: workspace._id,
      quickflow: quickflow._id,
      instagramUserId,
      instagramUsername,
      triggerType,
      triggerContent,
      responseSent,
      responseContent,
      responseId
    });

    // Update quickflow statistics
    await InstagramQuickflow.findByIdAndUpdate(
      quickflow._id,
      {
        $inc: { totalTriggered: 1 },
        ...(responseSent && { 
          $inc: { totalRepliesSent: 1 },
          lastReplySentAt: new Date()
        }),
        lastTriggeredAt: new Date()
      }
    );

    return {
      success: responseSent,
      responseId,
      responseContent
    };
  } catch (err) {
    console.error('Error sending Instagram quickflow response:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Match keywords against trigger content
 */
function matchKeywords(content, keywords, matchMode) {
  if (!keywords || keywords.length === 0) {
    return true; // No keywords means match all
  }

  const normalizedContent = (content || '').toLowerCase().trim();

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase().trim();

    switch (matchMode) {
      case 'exact':
        if (normalizedContent === normalizedKeyword) {
          return true;
        }
        break;

      case 'starts_with':
        if (normalizedContent.startsWith(normalizedKeyword)) {
          return true;
        }
        break;

      case 'contains':
      default:
        if (normalizedContent.includes(normalizedKeyword)) {
          return true;
        }
        break;
    }
  }

  return false;
}

/**
 * Get preset quickflow configuration
 */function getPresetConfig(presetType) {
  const presets = {
    price_please: {
      name: 'Price Please',
      type: 'price_please',
      triggerType: 'comment',
      keywords: ['price', 'cost', 'how much', '$'],
      matchMode: 'contains',
      response: {
        message: 'Thanks for your interest! 💰 Please check our DMs for pricing details.'
      },
      enabled: true
    },
    giveaway: {
      name: 'Giveaway',
      type: 'giveaway',
      triggerType: 'comment',
      keywords: ['giveaway', 'contest', 'free'],
      matchMode: 'contains',
      response: {
        message: '🎁 Thanks for entering! Check your DMs for more details and terms.'
      },
      enabled: true
    },
    lead_gen: {
      name: 'Lead Generation',
      type: 'lead_gen',
      triggerType: 'dm',
      keywords: ['info', 'interested', 'tell me'],
      matchMode: 'contains',
      response: {
        message: '👋 Thanks for reaching out! We\'d love to help. Chat with us on WhatsApp for faster response.',
        redirectToWhatsApp: {
          enabled: true,
          message: 'Click here to chat on WhatsApp'
        }
      },
      enabled: true
    },
    story_auto_reply: {
      name: 'Story Auto Reply',
      type: 'story_auto_reply',
      triggerType: 'story_reply',
      keywords: [],
      matchMode: 'contains',
      response: {
        message: '👋 Thanks for viewing our story! We\'re here to help.'
      },
      enabled: true
    }
  };

  return presets[presetType] || null;
}

/**
 * Get plan limits for Instagram quickflows
 */
function getInstagramQuickflowLimits(plan) {
  const limits = {
    free: {
      quickflows: 2,
      presetsAvailable: ['price_please'],
      customKeywords: false
    },
    basic: {
      quickflows: 5,
      presetsAvailable: ['price_please', 'giveaway', 'lead_gen'],
      customKeywords: true
    },
    premium: {
      quickflows: Infinity,
      presetsAvailable: ['price_please', 'giveaway', 'lead_gen', 'story_auto_reply'],
      customKeywords: true
    }
  };

  return limits[plan] || limits.free;
}

/**
 * Check if workspace can create more quickflows
 */
async function checkInstagramQuickflowLimits(workspace) {
  try {
    const limits = getInstagramQuickflowLimits(workspace.plan);
    
    if (limits.unlimited) {
      return { allowed: true };
    }

    const count = await InstagramQuickflow.countDocuments({ workspace });
    
    if (count >= limits.quickflows) {
      return {
        allowed: false,
        reason: `Plan limit of ${limits.quickflows} quickflows exceeded`,
        current: count,
        limit: limits.quickflows
      };
    }

    return {
      allowed: true,
      current: count,
      limit: limits.quickflows
    };
  } catch (err) {
    console.error('Error checking quickflow limits:', err);
    return { allowed: false, reason: 'Error checking limits' };
  }
}

module.exports = {
  checkInstagramQuickflow,
  checkInstagramQuickflowWindow,
  sendInstagramQuickflowResponse,
  matchKeywords,
  getPresetConfig,
  getInstagramQuickflowLimits,
  checkInstagramQuickflowLimits
};
