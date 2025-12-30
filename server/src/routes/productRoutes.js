const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  getProductStats
} = require('../controllers/productController');
const { planCheck } = require('../middlewares/planCheck');

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Private
 * @param   {string} name - Product name (required)
 * @param   {number} price - Product price (required)
 * @param   {number} stock - Product stock quantity (required)
 * @param   {string} currency - Currency code (default: INR)
 * @param   {string} category - Product category (optional)
 * @param   {string} description - Product description (optional)
 * @param   {array} images - Product images with url, alt, isPrimary (optional)
 * @param   {boolean} isActive - Product active status (default: true)
 * @returns {object} Created product
 */
router.post('/', planCheck('products', 1), createProduct);

/**
 * @route   GET /api/v1/products
 * @desc    Get list of products
 * @access  Private
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 10, max: 100)
 * @query   {string} category - Filter by category
 * @query   {boolean} isActive - Filter by active status
 * @query   {string} search - Search by name or description
 * @query   {string} sortBy - Sort field (default: -createdAt)
 * @returns {array} List of products with pagination
 */
router.get('/', listProducts);

/**
 * @route   GET /api/v1/products/stats
 * @desc    Get product catalog statistics
 * @access  Private
 * @returns {object} Statistics including counts, stock info, and plan details
 */
router.get('/stats', getProductStats);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get a single product by ID
 * @access  Private
 * @param   {string} id - Product ID
 * @returns {object} Product details
 */
router.get('/:id', getProduct);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update a product
 * @access  Private
 * @param   {string} id - Product ID
 * @body    {object} Updated product fields (all optional)
 * @returns {object} Updated product
 */
router.put('/:id', updateProduct);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Soft delete a product
 * @access  Private
 * @param   {string} id - Product ID
 * @returns {object} Success message
 */
router.delete('/:id', deleteProduct);

/**
 * @route   POST /api/v1/products/:id/restore
 * @desc    Restore a soft-deleted product
 * @access  Private
 * @param   {string} id - Product ID
 * @returns {object} Restored product
 */
router.post('/:id/restore', restoreProduct);

module.exports = router;
