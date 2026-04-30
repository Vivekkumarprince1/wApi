import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3003,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wapi_billing',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
};
