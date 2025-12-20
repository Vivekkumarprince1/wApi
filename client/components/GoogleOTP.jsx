import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaEnvelope, FaClock, FaCheck } from 'react-icons/fa';
import { verifyGoogleOTP } from '@/lib/api';

const GoogleOTP = ({ 
  email, 
  onBack, 
  onSuccess, 
  onError 
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // 1 minute
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      onError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyGoogleOTP({
        email,
        otp: otpString
      });
      
      onSuccess(data);
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      // For Google OTP, we need to trigger Google login again
      // This will be handled by the parent component
      onError('Please try Google login again to resend OTP');
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaEnvelope className="text-white text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Verify Your Google Login
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            We've sent a 6-digit code to
          </p>
          <p className="text-green-600 dark:text-green-400 font-medium">
            {email}
          </p>
        </div>

        {/* OTP Input */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Enter the 6-digit code
            </label>
            <div className="flex justify-between space-x-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  placeholder="0"
                />
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <FaClock className="text-gray-500" />
              <span>Code expires in {formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || otp.join('').length !== 6}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              loading || otp.join('').length !== 6
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Verifying...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <FaCheck className="mr-2" />
                Verify & Login
              </div>
            )}
          </button>

          {/* Resend OTP */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={!canResend || loading}
              className={`text-sm font-medium transition-colors ${
                canResend && !loading
                  ? 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              {canResend ? 'Try Google Login Again' : `Resend in ${formatTime(timeLeft)}`}
            </button>
          </div>
        </form>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <FaArrowLeft className="text-sm" />
            <span>Back to Login</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default GoogleOTP; 