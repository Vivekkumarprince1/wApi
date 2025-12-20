const express = require('express');
const { body } = require('express-validator');
const {
  getWhatsAppSetupRequests,
  updateWhatsAppSetupStatus,
  reinitializeAllWABA,
  getVerificationRequests,
  updateVerificationStatus,
  manuallyActivateWhatsApp
} = require('../controllers/adminController');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');

const router = express.Router();

// All admin routes require authentication
// TODO: Add admin role middleware

// WhatsApp setup management
router.get('/whatsapp-setup-requests', auth, getWhatsAppSetupRequests);
router.put('/whatsapp-setup-requests/:workspaceId', auth, updateWhatsAppSetupStatus);

// Business verification management
router.get('/verification-requests', auth, getVerificationRequests);
router.put('/verification-requests/:workspaceId', auth, updateVerificationStatus);

// Manual activation (admin override)
router.post('/workspaces/:workspaceId/activate-whatsapp', auth, manuallyActivateWhatsApp);

// Force reinitialize all workspaces with WABA credentials from environment
router.post('/reinitialize-waba', auth, reinitializeAllWABA);

module.exports = router;
