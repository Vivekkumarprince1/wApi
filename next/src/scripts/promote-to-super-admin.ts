import mongoose from 'mongoose';
import { User } from '../lib/models/auth/User';
import dbConnect from '../lib/db-connect';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function promoteToSuperAdmin(email: string) {
  try {
    console.log(`Connecting to database...`);
    await dbConnect();

    console.log(`Searching for user with email: ${email}...`);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`Error: User with email ${email} not found.`);
      process.exit(1);
    }

    console.log(`Current role for ${user.email} is: ${user.role}`);
    
    if (user.role === 'super_admin') {
      console.log(`User is already a super_admin.`);
    } else {
      user.role = 'super_admin' as any;
      await user.save();
      console.log(`SUCCESS: User ${user.email} has been promoted to super_admin.`);
    }

    process.exit(0);
  } catch (error: any) {
    console.error(`FATAL ERROR: ${error.message}`);
    process.exit(1);
  }
}

// Get email from command line arguments
const emailArg = process.argv[2];

if (!emailArg) {
  console.error('Usage: npx ts-node src/scripts/promote-to-super-admin.ts <email>');
  process.exit(1);
}

promoteToSuperAdmin(emailArg);
