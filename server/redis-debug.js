require('dotenv').config();
const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
console.log('--- Redis Debug Info ---');
console.log('REDIS_URL:', redisUrl);

const client = createClient({ url: redisUrl });

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

async function testConnection() {
  console.log('Attempting to connect...');
  try {
    await client.connect();
    console.log('Successfully connected to Redis!');
    await client.disconnect();
  } catch (err) {
    console.error('Failed to connect:', err);
  }
}

testConnection();
