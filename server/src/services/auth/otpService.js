/**
 * OTP SERVICE
 * One-time password generation, validation, and management
 */

const crypto = require('crypto');
const { getRedis, setJson, getJson, deleteKey } = require('../../config/redis');
const logger = require('../../utils/logger');

class OtpService {
  constructor() {
    this.redis = getRedis();
    this.otpLength = 6;
    this.otpExpiry = 5 * 60; // 5 minutes
    this.maxAttempts = 3;
  }

  /**
   * Generate OTP for a user
   */
  generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Store OTP in cache with metadata
   */
  async storeOtp(identifier, otp, purpose = 'verification') {
    const key = `otp:${purpose}:${identifier}`;
    const data = {
      otp: await this.hashOtp(otp),
      attempts: 0,
      createdAt: new Date().toISOString(),
      purpose
    };

    await setJson(key, data, this.otpExpiry);

    logger.info('OTP stored', { identifier, purpose });
    return otp; // Return plain OTP for sending
  }

  /**
   * Hash OTP for secure storage
   */
  async hashOtp(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Verify OTP
   */
  async verifyOtp(identifier, otp, purpose = 'verification') {
    try {
      const key = `otp:${purpose}:${identifier}`;
      const data = await getJson(key);

      if (!data) {
        throw new Error('OTP not found or expired');
      }

      if (data.attempts >= this.maxAttempts) {
        await deleteKey(key); // Clean up after max attempts
        throw new Error('Maximum verification attempts exceeded');
      }

      const hashedInput = await this.hashOtp(otp);
      const isValid = hashedInput === data.otp;

      // Increment attempts
      data.attempts += 1;
      await setJson(key, data, this.otpExpiry);

      if (!isValid) {
        logger.warn('Invalid OTP attempt', { identifier, purpose, attempts: data.attempts });
        throw new Error('Invalid OTP');
      }

      // Clean up on successful verification
      await deleteKey(key);

      logger.info('OTP verified successfully', { identifier, purpose });
      return true;
    } catch (error) {
      logger.warn('OTP verification failed', {
        identifier,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send OTP via email (placeholder - integrate with actual email service)
   */
  async sendEmailOtp(email, otp) {
    // TODO: Integrate with email service (Nodemailer, SendGrid, etc.)
    logger.info('Email OTP sent', { email });
    console.log(`OTP for ${email}: ${otp}`); // Temporary logging
  }

  /**
   * Send OTP via SMS (placeholder - integrate with actual SMS service)
   */
  async sendSmsOtp(phone, otp) {
    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    logger.info('SMS OTP sent', { phone });
    console.log(`OTP for ${phone}: ${otp}`); // Temporary logging
  }

  /**
   * Generate and send OTP for login
   */
  async sendLoginOtp(identifier, method = 'email') {
    const otp = this.generateOtp();
    await this.storeOtp(identifier, otp, 'login');

    if (method === 'email') {
      await this.sendEmailOtp(identifier, otp);
    } else if (method === 'sms') {
      await this.sendSmsOtp(identifier, otp);
    }

    return { success: true, message: 'OTP sent successfully' };
  }

  /**
   * Verify login OTP
   */
  async verifyLoginOtp(identifier, otp) {
    return await this.verifyOtp(identifier, otp, 'login');
  }

  /**
   * Generate and send OTP for password reset
   */
  async sendPasswordResetOtp(email) {
    const otp = this.generateOtp();
    await this.storeOtp(email, otp, 'password_reset');

    await this.sendEmailOtp(email, otp);

    return { success: true, message: 'Password reset OTP sent' };
  }

  /**
   * Verify password reset OTP
   */
  async verifyPasswordResetOtp(email, otp) {
    return await this.verifyOtp(email, otp, 'password_reset');
  }

  /**
   * Generate and send OTP for email verification
   */
  async sendEmailVerificationOtp(email) {
    const otp = this.generateOtp();
    await this.storeOtp(email, otp, 'email_verification');

    await this.sendEmailOtp(email, otp);

    return { success: true, message: 'Email verification OTP sent' };
  }

  /**
   * Verify email verification OTP
   */
  async verifyEmailVerificationOtp(email, otp) {
    return await this.verifyOtp(email, otp, 'email_verification');
  }

  /**
   * Clean up expired OTPs (can be called by cron job)
   */
  async cleanupExpiredOtps() {
    // Redis handles expiry automatically, but this could be used for custom cleanup
    logger.info('OTP cleanup completed');
  }

  /**
   * Get OTP status for debugging
   */
  async getOtpStatus(identifier, purpose = 'verification') {
    const key = `otp:${purpose}:${identifier}`;
    const data = await getJson(key);

    if (!data) {
      return { exists: false };
    }

    return {
      exists: true,
      attempts: data.attempts,
      createdAt: data.createdAt,
      purpose: data.purpose,
      timeRemaining: await this.getTimeRemaining(key)
    };
  }

  /**
   * Get remaining time for OTP
   */
  async getTimeRemaining(key) {
    // This would require Redis TTL command
    // For now, return approximate based on creation time
    try {
      const data = await getJson(key);
      if (!data) return 0;

      const createdAt = new Date(data.createdAt);
      const now = new Date();
      const elapsed = Math.floor((now - createdAt) / 1000);
      const remaining = Math.max(0, this.otpExpiry - elapsed);

      return remaining;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new OtpService();