const express = require('express');
const externalApiController = require('../../controllers/developer/externalApiController');

const router = express.Router();

/**
 * External Public Routes (Business Websites)
 * Authenticated via 'x-api-key' header (handled in controller)
 */

router.post('/auth/send-otp', externalApiController.sendOtp);

module.exports = router;
