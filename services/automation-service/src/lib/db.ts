import mongoose from 'mongoose';

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI_AUTOMATION ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/connectsphere_automation';

export const dbConnect = async () => {
  if (mongoose.connection.readyState >= 1) return;

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to Automation Microservice Database');
  } catch (error) {
    console.error('Error connecting to Automation Database:', error);
    process.exit(1);
  }
};

export default dbConnect;
