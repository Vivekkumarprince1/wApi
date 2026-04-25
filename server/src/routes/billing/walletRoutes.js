const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/billing/walletController');
const auth = require('../../middlewares/auth');

// All wallet routes are protected
router.use(auth);

router.get('/status', walletController.getWalletStatus);
router.get('/transactions', walletController.getTransactions);
router.post('/recharge/initiate', walletController.initiateRecharge);
router.post('/recharge/verify', walletController.verifyRecharge);

module.exports = router;
