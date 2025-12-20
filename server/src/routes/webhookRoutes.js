const express = require('express');
const { handler, verify } = require('../controllers/metaWebhookController');

const router = express.Router();

// Meta webhook for WhatsApp business
router.get('/meta', verify);
router.post('/meta', express.json(), handler);

module.exports = router;
