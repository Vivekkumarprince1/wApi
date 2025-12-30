const express = require('express');
const auth = require('../middlewares/auth');
const { 
  getWhatsAppNumberStatus, 
  getWABASettings, 
  updateWABASettings, 
  createWABASettings, 
  initializeWABAFromEnv,
  testWABAConnection,
  debugMetaCredentials,
  getCommerceSettings,
  updateCommerceSettings,
  validateCommerceConfig
} = require('../controllers/settingsController');

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

// Commerce Settings Routes
router.get('/commerce', getCommerceSettings);
router.put('/commerce', updateCommerceSettings);
router.post('/commerce/validate', validateCommerceConfig);

module.exports = router;