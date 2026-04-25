/**
 * AUTH SERVICE
 * Authentication business logic
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('../../utils/crypto');
const { createError, ERROR_CODES } = require('../../utils/errorFormatter');
const logger = require('../../utils/logger');

class AuthService {
  /**
   * Generate JWT token
   */
  generateToken(payload, expiresIn = '24h') {
    try {
      return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
    } catch (error) {
      logger.error('Failed to generate JWT token', { error: error.message });
      throw createError(ERROR_CODES.INTERNAL_ERROR, 'Token generation failed');
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw createError(ERROR_CODES.TOKEN_EXPIRED, 'Token has expired');
      }
      throw createError(ERROR_CODES.UNAUTHORIZED, 'Invalid token');
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    try {
      return await crypto.hash(password);
    } catch (error) {
      logger.error('Failed to hash password', { error: error.message });
      throw createError(ERROR_CODES.INTERNAL_ERROR, 'Password hashing failed');
    }
  }

  /**
   * Verify password
   */
  async verifyPassword(password, hashedPassword) {
    try {
      return await crypto.verifyHash(password, hashedPassword);
    } catch (error) {
      logger.error('Failed to verify password', { error: error.message });
      return false;
    }
  }

  /**
   * Generate secure reset token
   */
  generateResetToken() {
    return crypto.generateToken(32);
  }

  /**
   * Generate OTP
   */
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }
}

module.exports = new AuthService();