const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkAndCreateUser() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const email = 'vivekkumarprince1@gmail.com';
    const user = await usersCollection.findOne({ email: email.toLowerCase() });

    if (user) {
      console.log('User found:', {
        id: user._id,
        email: user.email,
        role: user.role,
      });
      if (user.role !== 'super_admin') {
        console.log('Promoting user to super_admin...');
        await usersCollection.updateOne({ _id: user._id }, { $set: { role: 'super_admin' } });
        console.log('Successfully promoted user to super_admin.');
      }
    } else {
      console.log('User not found. Creating user...');
      const hashedPassword = await bcrypt.hash('Prince1@', 10);
      const newUser = {
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'super_admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        isVerified: true
      };
      const result = await usersCollection.insertOne(newUser);
      console.log('Created user with ID:', result.insertedId);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAndCreateUser();
