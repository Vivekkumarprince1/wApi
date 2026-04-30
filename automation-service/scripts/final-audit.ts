import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const SOURCE_URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function finalAudit() {
  try {
    const conn = await mongoose.connect(SOURCE_URI);
    const db = conn.connection.db;
    if (!db) throw new Error('DB not found');

    const collections = [
      'automationrules',
      'autoreplies',
      'whatsappflows',
      'whatsappforms',
      'interaktivelists',
      'answerbotsettings',
      'instagramquickflows'
    ];

    console.log('--- Final Audit of Source Data ---');
    for (const col of collections) {
      const count = await db.collection(col).countDocuments();
      console.log(`${col}: ${count}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

finalAudit();
