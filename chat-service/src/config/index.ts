import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3008', 10),
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wapi',
  kafkaBroker: process.env.KAFKA_BROKER || 'localhost:9092',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  authCookieName: 'auth_token',
};

export default config;
