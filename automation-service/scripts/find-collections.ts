import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function findAutomationCollections() {
  try {
    const conn = await mongoose.connect(URI);
    const collections = await conn.connection.db?.listCollections().toArray();
    const names = collections?.map(c => c.name) || [];
    
    console.log('--- Search Results for "auto" or "rule" or "flow" ---');
    const filtered = names.filter(n => 
      n.toLowerCase().includes('auto') || 
      n.toLowerCase().includes('rule') || 
      n.toLowerCase().includes('flow') ||
      n.toLowerCase().includes('intent')
    );
    console.log(filtered);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

findAutomationCollections();
