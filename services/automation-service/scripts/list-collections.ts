import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function listCollections() {
  try {
    const conn = await mongoose.connect(URI);
    const collections = await conn.connection.db?.listCollections().toArray();
    console.log('Collections in test:', collections?.map(c => c.name));
    process.exit(0);
  } catch (err) {
    console.error('Error listing collections:', err);
    process.exit(1);
  }
}

listCollections();
