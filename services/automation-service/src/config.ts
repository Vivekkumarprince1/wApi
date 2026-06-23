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

const monolithInternalUrl = process.env.MONOLITH_INTERNAL_URL || process.env.MONOLITH_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5001');

if (!monolithInternalUrl) {
  throw new Error('FATAL: MONOLITH_URL environment variable is required for automation-service.');
}

export const config = {
  jwtSecret,
  internalServiceSecret,
  monolithInternalUrl,
};
