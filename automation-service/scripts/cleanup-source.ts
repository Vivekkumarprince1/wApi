import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const SOURCE_URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function cleanupSource() {
  try {
    console.log('--- Cleaning Up Source Database ---');
    const conn = await mongoose.connect(SOURCE_URI);
    const db = conn.connection.db;
    if (!db) throw new Error('DB not found');

    const collectionsToDelete = [
      'automationrules',
      'autoreplies',
      'autoreplylogs',
      'automationexecutions',
      'workflowexecutions',
      'answerbotsettings',
      'answerbotsources',
      'aiintentmatchlogs',
      'automationAuditLogs',
      'interaktivelists',
      'instagramquickflows',
      'instagramquickflowlogs'
    ];

    for (const col of collectionsToDelete) {
      const count = await db.collection(col).countDocuments();
      if (count > 0) {
        console.log(`Deleting ${count} records from ${col}...`);
        await db.collection(col).deleteMany({});
        console.log(`Successfully cleared ${col}.`);
      } else {
        console.log(`${col} is already empty.`);
      }
    }

    console.log('Source cleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

cleanupSource();
