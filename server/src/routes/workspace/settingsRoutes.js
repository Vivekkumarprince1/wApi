const express = require('express');
const auth = require('../../middlewares/auth');
const { 
  getWhatsAppNumberStatus, 
  getWABASettings, 
  updateWABASettings, 
  createWABASettings, 
  initializeWABAFromEnv,
  testWABAConnection,
  debugMetaCredentials,
  updateBusinessInfo,
  getCommerceSettings,
  updateCommerceSettings,
  validateCommerceConfig,
  getInboxSettings,
  updateInboxSettings,
  getRCSConfig,
  updateRCSConfig,
  getSMSConfig,
  updateSMSConfig,
  getWalletBalance,
  getWalletTransactions
} = require('../../controllers/workspace/settingsController');

const router = express.Router();

router.use(auth);

// WABA Settings Routes
router.get('/whatsapp-number', getWhatsAppNumberStatus);
router.get('/waba', getWABASettings);
router.put('/waba', updateWABASettings);
router.post('/waba', createWABASettings);
router.post('/waba/init-from-env', initializeWABAFromEnv);
router.post('/waba/test', testWABAConnection);
router.get('/waba/debug', debugMetaCredentials);
router.patch('/business-info', updateBusinessInfo);

// Inbox & Assignment Settings Routes
router.get('/inbox', getInboxSettings);
router.put('/inbox', updateInboxSettings);

// Commerce Settings Routes
router.get('/commerce', getCommerceSettings);
router.put('/commerce', updateCommerceSettings);
router.post('/commerce/validate', validateCommerceConfig);

// RCS Settings Routes
router.get('/channels/rcs', getRCSConfig);
router.post('/channels/rcs', updateRCSConfig);

// SMS Settings Routes
router.get('/channels/sms', getSMSConfig);
router.post('/channels/sms', updateSMSConfig);

// Wallet Settings Routes
router.get('/wallet', getWalletBalance);
router.get('/wallet/transactions', getWalletTransactions);

module.exports = router;