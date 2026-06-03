import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/?appName=Cluster0';

async function listDBs() {
  try {
    const conn = await mongoose.connect(URI);
    const admin = conn.connection.db?.admin();
    const dbs = await admin?.listDatabases();
    console.log('Available Databases:', dbs?.databases.map(db => db.name));
    process.exit(0);
  } catch (err) {
    console.error('Error listing DBs:', err);
    process.exit(1);
  }
}

listDBs();
