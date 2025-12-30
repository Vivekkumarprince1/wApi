const Product = require('../models/Product');
const Workspace = require('../models/Workspace');
const mongoose = require('mongoose');

// Plan-based product limits
const PRODUCT_LIMITS = {
  free: 10,
  basic: 50,
  premium: 500,
  enterprise: -1 // Unlimited
};

/**
 * Create a new product
 * POST /api/v1/products
 * Enforces plan-based limits
 */
async function createProduct(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Get product count for workspace
    const productCount = await Product.countDocuments({
      workspaceId,
      isDeleted: false
    });

    // Check plan limit
    const limit = PRODUCT_LIMITS[workspace.plan];
    if (limit !== -1 && productCount >= limit) {
      return res.status(403).json({
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `Your ${workspace.plan} plan allows up to ${limit} products. You've reached the limit.`,
        current: productCount,
        limit: limit,
        action: 'upgrade_plan'
      });
    }

    // Validate required fields
    const { name, price, stock, currency, category, description, images, isActive } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Product name is required' });
    }

    if (price === undefined || price === null || isNaN(price)) {
      return res.status(400).json({ message: 'Product price is required and must be a valid number' });
    }

    if (price < 0) {
      return res.status(400).json({ message: 'Product price cannot be negative' });
    }

    if (stock === undefined || stock === null || !Number.isInteger(stock)) {
      return res.status(400).json({ message: 'Product stock is required and must be a whole number' });
    }

    if (stock < 0) {
      return res.status(400).json({ message: 'Product stock cannot be negative' });
    }

    // Validate currency if provided
    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'];
    if (currency && !validCurrencies.includes(currency)) {
      return res.status(400).json({
        message: `Invalid currency. Supported: ${validCurrencies.join(', ')}`
      });
    }

    // Validate images if provided
    if (images && Array.isArray(images)) {
      for (let img of images) {
        if (!img.url || img.url.trim() === '') {
          return res.status(400).json({ message: 'Image URL is required for all images' });
        }
        // Validate URL format
        try {
          new URL(img.url);
        } catch (e) {
          return res.status(400).json({ message: `Invalid image URL: ${img.url}` });
        }
      }
    }

    // Create product
    const productData = {
      workspaceId,
      name: name.trim(),
      price: parseFloat(price),
      stock: parseInt(stock),
      currency: currency || 'INR',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    if (description) {
      productData.description = description.trim();
    }

    if (category) {
      productData.category = category.trim();
    }

    if (images && images.length > 0) {
      productData.images = images.map(img => ({
        url: img.url.trim(),
        alt: img.alt ? img.alt.trim() : '',
        isPrimary: img.isPrimary || false
      }));
    }

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: product
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get list of products
 * GET /api/v1/products
 * Supports filtering, pagination, search
 */
async function listProducts(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { page = 1, limit = 10, category, isActive, search, sortBy = '-createdAt' } = req.query;

    const query = {
      workspaceId,
      isDeleted: false
    };

    // Filter by category
    if (category) {
      query.category = category.trim();
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Count total
    const total = await Product.countDocuments(query);

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page

    // Fetch products
    const products = await Product.find(query)
      .sort(sortBy)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single product by ID
 * GET /api/v1/products/:id
 */
async function getProduct(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findOne({
      _id: id,
      workspaceId,
      isDeleted: false
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      success: true,
      product
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update a product
 * PUT /api/v1/products/:id
 */
async function updateProduct(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Find product
    const product = await Product.findOne({
      _id: id,
      workspaceId,
      isDeleted: false
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Fields that can be updated
    const { name, description, price, stock, currency, category, images, isActive } = req.body;

    // Validate fields if provided
    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({ message: 'Product name cannot be empty' });
      }
      product.name = name.trim();
    }

    if (description !== undefined) {
      product.description = description.trim();
    }

    if (price !== undefined) {
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ message: 'Price must be a valid number >= 0' });
      }
      product.price = parseFloat(price);
    }

    if (stock !== undefined) {
      if (!Number.isInteger(parseInt(stock)) || parseInt(stock) < 0) {
        return res.status(400).json({ message: 'Stock must be a whole number >= 0' });
      }
      product.stock = parseInt(stock);
    }

    if (currency !== undefined) {
      const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({
          message: `Invalid currency. Supported: ${validCurrencies.join(', ')}`
        });
      }
      product.currency = currency;
    }

    if (category !== undefined) {
      product.category = category.trim() || null;
    }

    if (isActive !== undefined) {
      product.isActive = isActive;
    }

    if (images !== undefined) {
      // Validate images
      if (Array.isArray(images)) {
        for (let img of images) {
          if (!img.url || img.url.trim() === '') {
            return res.status(400).json({ message: 'Image URL is required for all images' });
          }
          try {
            new URL(img.url);
          } catch (e) {
            return res.status(400).json({ message: `Invalid image URL: ${img.url}` });
          }
        }
        product.images = images.map(img => ({
          url: img.url.trim(),
          alt: img.alt ? img.alt.trim() : '',
          isPrimary: img.isPrimary || false
        }));
      }
    }

    // Update audit trail
    product.updatedBy = req.user._id;

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Soft delete a product
 * DELETE /api/v1/products/:id
 * Marks product as deleted but keeps data
 */
async function deleteProduct(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findOne({
      _id: id,
      workspaceId,
      isDeleted: false
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Soft delete
    product.isDeleted = true;
    product.deletedAt = new Date();
    product.updatedBy = req.user._id;

    await product.save();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Restore a soft-deleted product
 * POST /api/v1/products/:id/restore
 */
async function restoreProduct(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findOne({
      _id: id,
      workspaceId,
      isDeleted: true
    });

    if (!product) {
      return res.status(404).json({ message: 'Deleted product not found' });
    }

    // Restore
    product.isDeleted = false;
    product.deletedAt = null;
    product.updatedBy = req.user._id;

    await product.save();

    res.json({
      success: true,
      message: 'Product restored successfully',
      product
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get product catalog stats
 * GET /api/v1/products/stats
 */
async function getProductStats(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Count products
    const totalProducts = await Product.countDocuments({
      workspaceId,
      isDeleted: false
    });

    const activeProducts = await Product.countDocuments({
      workspaceId,
      isDeleted: false,
      isActive: true
    });

    const inactiveProducts = await Product.countDocuments({
      workspaceId,
      isDeleted: false,
      isActive: false
    });

    const deletedProducts = await Product.countDocuments({
      workspaceId,
      isDeleted: true
    });

    // Get total stock
    const stockAgg = await Product.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalStock: { $sum: '$stock' },
          outOfStock: {
            $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
          },
          lowStock: {
            $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 10] }] }, 1, 0] }
          }
        }
      }
    ]);

    const stockInfo = stockAgg.length > 0 ? stockAgg[0] : {
      totalStock: 0,
      outOfStock: 0,
      lowStock: 0
    };

    // Plan info
    const limit = PRODUCT_LIMITS[workspace.plan];

    res.json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        inactiveProducts,
        deletedProducts,
        stock: {
          total: stockInfo.totalStock,
          outOfStock: stockInfo.outOfStock,
          lowStock: stockInfo.lowStock
        },
        plan: {
          current: workspace.plan,
          limit: limit === -1 ? 'Unlimited' : limit,
          used: totalProducts,
          remaining: limit === -1 ? 'Unlimited' : Math.max(0, limit - totalProducts)
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  getProductStats
};
