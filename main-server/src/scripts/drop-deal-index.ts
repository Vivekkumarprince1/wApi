import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI not found in .env');
  process.exit(1);
}

async function run() {
  const client = new MongoClient(uri!);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // The error indicated the 'test.deals' collection
    // appName or URI might specify the DB, but usually it's 'test' if not specified
    // Let's try to extract DB from URI or default to 'test'
    const dbName = uri!.split('/').pop()?.split('?')[0] || 'test';
    const db = client.db(dbName);
    const collection = db.collection('deals');

    console.log(`Working on DB: ${dbName}, collection: deals`);

    // List indexes first
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    const indexesToDrop = [
      'workspace_1_contact_1_status_1',
      'workspace_1_contact_1'
    ];

    for (const name of indexesToDrop) {
      if (indexes.find(i => i.name === name)) {
        console.log(`Dropping index: ${name}`);
        await collection.dropIndex(name);
        console.log(`Successfully dropped ${name}`);
      } else {
        console.log(`Index ${name} not found, skipping.`);
      }
    }

    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

run();
