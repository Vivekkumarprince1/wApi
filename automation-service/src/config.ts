import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;

if (!jwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is required for automation-service.');
}

if (!internalServiceSecret) {
  throw new Error('FATAL: INTERNAL_SERVICE_SECRET environment variable is required for automation-service.');
}

export const config = {
  jwtSecret,
  internalServiceSecret,
  monolithInternalUrl: process.env.MONOLITH_INTERNAL_URL || 'http://localhost:5001',
};
