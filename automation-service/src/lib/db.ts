import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI_AUTOMATION || 'mongodb://localhost:27017/wapi_automation';

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
