import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const [, , emailInput, password] = process.argv;
const email = String(emailInput || '').trim().toLowerCase();
const mongoUri = process.env.MONGO_URI || process.env.AUTH_MONGO_URI;

if (!email || !password) {
  console.error('Usage: npm run set-user-password -- <email> <new-password>');
  process.exit(1);
}

if (!mongoUri) {
  console.error('MONGO_URI or AUTH_MONGO_URI must be configured.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(mongoUri);

  const result = await mongoose.connection.collection('users').updateOne(
    { email },
    { $set: { passwordHash: await bcrypt.hash(password, 12), updatedAt: new Date() } },
  );

  if (result.matchedCount !== 1) {
    throw new Error(`No user account found for ${email}.`);
  }

  console.log(`Password updated for ${email}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unable to update password.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
