const { getPartnerToken } = require('../services/partnerTokenService');
const { logger } = require('../utils/logger');

// Express middleware to auto-inject the partner token into req
async function requirePartnerToken(req, res, next) {
  try {
    const token = await getPartnerToken();
    req.gupshupPartnerToken = token;
    next();
  } catch (error) {
    logger.error('Failed to inject partner token in middleware', error.message);
    res.status(500).json({ error: 'Failed to retrieve Gupshup Partner Token' });
  }
}

module.exports = { requirePartnerToken };
