import mongoose from 'mongoose';
import config from './index.js';

export async function connectDb() {
  try {
    mongoose.set('bufferCommands', false);
    await mongoose.connect(config.mongoUri);
    console.log(`[Auth Service] Connected to MongoDB`);
  } catch (err: any) {
    console.error(`[Auth Service] Database connection failed: ${err.message}`);
    process.exit(1);
  }
}
