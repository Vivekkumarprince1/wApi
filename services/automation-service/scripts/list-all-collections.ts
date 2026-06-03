import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function listAll() {
  try {
    const conn = await mongoose.connect(URI);
    const collections = await conn.connection.db?.listCollections().toArray();
    console.log('--- All Collections in "test" ---');
    console.log(collections?.map(c => c.name).sort());
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

listAll();
