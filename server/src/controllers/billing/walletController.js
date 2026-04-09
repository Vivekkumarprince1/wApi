const walletService = require('../../services/billing/walletService');
const razorpayService = require('../../services/billing/razorpaySubscriptionService');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const Razorpay = require('razorpay');

/**
 * Handle Wallet Recharge initiation
 */
exports.initiateRecharge = async (req, res) => {
  try {
    const { amountPaise } = req.body;
    const workspaceId = req.user.workspace;

    if (!amountPaise || amountPaise < 10000) { // Min 100 INR
      return res.status(400).json({ error: 'Minimum recharge amount is 100 INR' });
    }

    const order = await razorpayService.createRechargeOrder(amountPaise, workspaceId);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    logger.error('[WalletController] initiateRecharge failed:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get wallet status (balance, history)
 */
exports.getWalletStatus = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const status = await walletService.getStatus(workspaceId);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get transaction history
 */
exports.getTransactions = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { limit, offset } = req.query;
    
    const history = await walletService.getTransactions(
      workspaceId, 
      parseInt(limit) || 20, 
      parseInt(offset) || 0
    );
    
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Verify payment signature and credit wallet
 */
exports.verifyRecharge = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;
    
    const workspaceId = req.user.workspace;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment signature' 
      });
    }

    // Capture payment details from Razorpay to get the actual amount 
    // (security check: don't trust amount from client)
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    
    if (payment.status !== 'captured') {
        // If not captured, try to capture it if it's authorized
        if (payment.status === 'authorized') {
            await razorpay.payments.capture(razorpay_payment_id, payment.amount, payment.currency);
        } else {
            return res.status(400).json({ success: false, message: 'Payment not captured' });
        }
    }

    // Credit the wallet
    await walletService.credit(workspaceId, payment.amount, {
      referenceType: 'SYSTEM',
      referenceId: null,
      description: `Razorpay Sync Recharge: ${razorpay_payment_id}`,
      metadata: { razorpayPaymentId: razorpay_payment_id, razorpayOrderId: razorpay_order_id }
    });

    res.json({ 
      success: true, 
      message: 'Payment verified and wallet credited',
      balance: (await walletService.getStatus(workspaceId)).balance
    });

  } catch (error) {
    console.error('[WalletController] verifyRecharge failed details:', {
      message: error.message,
      stack: error.stack,
      razorpayError: error.statusCode ? error.error : null
    });
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.statusCode ? error.error : 'Internal Server Error'
    });
  }
};
