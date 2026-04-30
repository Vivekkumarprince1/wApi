import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const SOURCE_URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function deepSearch() {
  try {
    const conn = await mongoose.connect(SOURCE_URI);
    const collections = await conn.connection.db?.listCollections().toArray();
    
    for (const col of collections || []) {
      const count = await conn.connection.db?.collection(col.name).countDocuments();
      if (count && count > 0) {
        // Sample one document to see if it has workspace field
        const doc = await conn.connection.db?.collection(col.name).findOne();
        if (doc && (doc.workspace || doc.workspaceId)) {
           console.log(`Collection: ${col.name} | Count: ${count} | Has Workspace: Yes`);
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

deepSearch();
