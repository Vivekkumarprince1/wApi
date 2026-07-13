import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { DotenvConfigOptions } from 'dotenv';

dotenv.config({ quiet: true } as DotenvConfigOptions);

// Source: wa_campaigns (where microservice was writing)
const SOURCE_URI = 'mongodb+srv://whats-api-automation:Prince123@cluster0.dtvexe1.mongodb.net/wa_campaigns?retryWrites=true&w=majority&appName=Cluster0';
// Destination: monolith test DB (shared by both now)
const DEST_URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function migrate() {
  console.log('🚀 Syncing campaign data from wa_campaigns → monolith test DB...');

  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();
  const destConn = await mongoose.createConnection(DEST_URI).asPromise();

  console.log('✅ Connected to both databases');

  const collections = [
    { name: 'campaigns' },
    { name: 'campaignbatches' },
    { name: 'campaignmessages' },
    { name: 'campaignsummaries' },
    { name: 'segments' }
  ];

  for (const col of collections) {
    console.log(`📦 Syncing ${col.name}...`);
    
    const sourceData = await sourceConn.collection(col.name).find({}).toArray();
    console.log(`🔍 Found ${sourceData.length} records in wa_campaigns.${col.name}`);

    if (sourceData.length > 0) {
      // Upsert each document to avoid duplicates
      for (const doc of sourceData) {
        await destConn.collection(col.name).replaceOne(
          { _id: doc._id },
          doc,
          { upsert: true }
        );
      }
      console.log(`✅ Synced ${sourceData.length} records for ${col.name}`);
    } else {
      console.log(`ℹ️ No data to sync for ${col.name}`);
    }
  }

  await sourceConn.close();
  await destConn.close();
  console.log('🏁 Sync completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
