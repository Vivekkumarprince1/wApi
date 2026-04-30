import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const SOURCE_URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function checkSourceData() {
  try {
    const conn = await mongoose.connect(SOURCE_URI);
    const rules = await conn.connection.db?.collection('automationrules').find({}).toArray();
    console.log('--- Source Data Check ---');
    console.log('Total Rules in Source:', rules?.length);
    const workspaces = [...new Set(rules?.map(r => r.workspace?.toString()))];
    console.log('Workspaces in Source:', workspaces);
    
    // Check other collections too
    const whatsappflows = await conn.connection.db?.collection('whatsappflows').find({}).toArray();
    console.log('Total WhatsApp Flows in Source:', whatsappflows?.length);

    const instagramflows = await conn.connection.db?.collection('instagramquickflows').find({}).toArray();
    console.log('Total Instagram Flows in Source:', instagramflows?.length);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkSourceData();
