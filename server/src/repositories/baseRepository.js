/**
 * BASE REPOSITORY
 * Abstract base class providing common CRUD operations for all repositories
 */

class BaseRepository {
  constructor(model) {
    if (!model) {
      throw new Error('Model is required for BaseRepository');
    }
    this.model = model;
  }

  /**
   * Find document by ID
   */
  async findById(id, options = {}) {
    try {
      const query = this.model.findById(id);
      if (options.populate) {
        query.populate(options.populate);
      }
      if (options.select) {
        query.select(options.select);
      }
      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find document by ID: ${error.message}`);
    }
  }

  /**
   * Find single document by conditions
   */
  async findOne(conditions, options = {}) {
    try {
      const query = this.model.findOne(conditions);
      if (options.populate) {
        query.populate(options.populate);
      }
      if (options.select) {
        query.select(options.select);
      }
      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find document: ${error.message}`);
    }
  }

  /**
   * Find multiple documents by conditions
   */
  async find(conditions = {}, options = {}) {
    try {
      const query = this.model.find(conditions);

      if (options.populate) {
        query.populate(options.populate);
      }
      if (options.select) {
        query.select(options.select);
      }
      if (options.sort) {
        query.sort(options.sort);
      }
      if (options.limit) {
        query.limit(options.limit);
      }
      if (options.skip) {
        query.skip(options.skip);
      }

      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find documents: ${error.message}`);
    }
  }

  /**
   * Create new document
   */
  async create(data) {
    try {
      const document = new this.model(data);
      return await document.save();
    } catch (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  /**
   * Update document by ID
   */
  async updateById(id, updateData, options = {}) {
    try {
      const updateOptions = {
        new: true,
        runValidators: true,
        ...options
      };
      return await this.model.findByIdAndUpdate(id, updateData, updateOptions);
    } catch (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  /**
   * Update single document by conditions
   */
  async updateOne(conditions, updateData, options = {}) {
    try {
      const updateOptions = {
        new: true,
        runValidators: true,
        ...options
      };
      return await this.model.findOneAndUpdate(conditions, updateData, updateOptions);
    } catch (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  /**
   * Update multiple documents
   */
  async updateMany(conditions, updateData, options = {}) {
    try {
      return await this.model.updateMany(conditions, updateData, options);
    } catch (error) {
      throw new Error(`Failed to update documents: ${error.message}`);
    }
  }

  /**
   * Delete document by ID
   */
  async deleteById(id) {
    try {
      return await this.model.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Delete single document by conditions
   */
  async deleteOne(conditions) {
    try {
      return await this.model.findOneAndDelete(conditions);
    } catch (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Delete multiple documents
   */
  async deleteMany(conditions) {
    try {
      return await this.model.deleteMany(conditions);
    } catch (error) {
      throw new Error(`Failed to delete documents: ${error.message}`);
    }
  }

  /**
   * Count documents by conditions
   */
  async count(conditions = {}) {
    try {
      return await this.model.countDocuments(conditions);
    } catch (error) {
      throw new Error(`Failed to count documents: ${error.message}`);
    }
  }

  /**
   * Check if document exists
   */
  async exists(conditions) {
    try {
      const count = await this.model.countDocuments(conditions).limit(1);
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check document existence: ${error.message}`);
    }
  }

  /**
   * Get paginated results
   */
  async paginate(conditions = {}, options = {}) {
    try {
      const page = Math.max(1, parseInt(options.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
      const skip = (page - 1) * limit;

      const [documents, total] = await Promise.all([
        this.find(conditions, { ...options, limit, skip }),
        this.count(conditions)
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        documents,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to paginate documents: ${error.message}`);
    }
  }
}

module.exports = BaseRepository;