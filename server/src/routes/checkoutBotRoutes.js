const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const {
  initializeCheckout,
  showProducts,
  selectProduct,
  addToCart,
  updateCart,
  getCartStatus,
  captureAddress,
  initiatePayment,
  confirmPayment,
  paymentFailed,
  abandonCart,
  getOrder,
  getOrders,
  getCheckoutStats
} = require('../controllers/checkoutBotController');

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/v1/checkout-bot/init
 * @desc    Initialize a new checkout session
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {string} conversationId - Conversation ID (optional)
 * @returns {object} Initialized cart
 */
router.post('/init', initializeCheckout);

/**
 * @route   GET /api/v1/checkout-bot/products
 * @desc    Show available products
 * @access  Private
 * @query   {string} category - Filter by category (optional)
 * @body    {string} contactId - Contact ID (required)
 * @returns {array} Products list
 */
router.get('/products', showProducts);

/**
 * @route   POST /api/v1/checkout-bot/select-product
 * @desc    Select a product for checkout
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {string} productId - Product ID (required)
 * @returns {object} Selected product details
 */
router.post('/select-product', selectProduct);

/**
 * @route   POST /api/v1/checkout-bot/add-to-cart
 * @desc    Add selected product to cart
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {number} quantity - Quantity to add (required, min 1)
 * @returns {object} Updated cart with totals
 */
router.post('/add-to-cart', addToCart);

/**
 * @route   GET /api/v1/checkout-bot/cart-status
 * @desc    Get current cart status
 * @access  Private
 * @query   {string} contactId - Contact ID (required)
 * @returns {object} Cart status, items, totals
 */
router.get('/cart-status', getCartStatus);

/**
 * @route   PUT /api/v1/checkout-bot/cart
 * @desc    Update cart (remove item, clear, etc)
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {string} action - 'remove' or 'clear' (required)
 * @body    {string} productId - Product ID (required for 'remove')
 * @returns {object} Updated cart
 */
router.put('/cart', updateCart);

/**
 * @route   POST /api/v1/checkout-bot/address
 * @desc    Capture delivery address
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {object} address - Address object with name, phone, street, city, pincode
 * @returns {object} Confirmed address
 */
router.post('/address', captureAddress);

/**
 * @route   POST /api/v1/checkout-bot/initiate-payment
 * @desc    Initiate payment and create order
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {string} paymentMethod - 'cod', 'razorpay', 'stripe', etc. (default: cod)
 * @returns {object} Order created with payment details
 */
router.post('/initiate-payment', initiatePayment);

/**
 * @route   POST /api/v1/checkout-bot/confirm-payment
 * @desc    Confirm payment and complete order
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {string} paymentId - Payment transaction ID (required)
 * @body    {string} paymentGateway - Gateway name (default: razorpay)
 * @returns {object} Order confirmed
 */
router.post('/confirm-payment', confirmPayment);

/**
 * @route   POST /api/v1/checkout-bot/payment-failed
 * @desc    Handle payment failure
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @body    {string} error - Error message (optional)
 * @returns {object} Failure response
 */
router.post('/payment-failed', paymentFailed);

/**
 * @route   POST /api/v1/checkout-bot/abandon
 * @desc    Abandon current checkout
 * @access  Private
 * @body    {string} contactId - Contact ID (required)
 * @returns {object} Success message
 */
router.post('/abandon', abandonCart);

/**
 * @route   GET /api/v1/checkout-bot/order/:orderId
 * @desc    Get order details
 * @access  Private
 * @param   {string} orderId - Order ID
 * @returns {object} Order details with items and address
 */
router.get('/order/:orderId', getOrder);

/**
 * @route   GET /api/v1/checkout-bot/orders
 * @desc    Get all orders for workspace
 * @access  Private
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 10, max: 100)
 * @query   {string} status - Filter by status (pending, confirmed, shipped, etc)
 * @query   {string} contactId - Filter by contact
 * @query   {string} sortBy - Sort field (default: -createdAt)
 * @returns {array} Orders with pagination
 */
router.get('/orders', getOrders);

/**
 * @route   GET /api/v1/checkout-bot/stats
 * @desc    Get checkout bot statistics
 * @access  Private
 * @returns {object} Carts, orders, revenue, conversion stats
 */
router.get('/stats', getCheckoutStats);

module.exports = router;
