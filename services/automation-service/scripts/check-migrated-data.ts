import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_URI = 'mongodb+srv://whats-api-automation:Prince123@cluster0.dtvexe1.mongodb.net/wa_automation?appName=Cluster0';

async function checkData() {
  try {
    const conn = await mongoose.connect(TARGET_URI);
    const rules = await conn.connection.db?.collection('automationrules').find({}).toArray();
    console.log('--- Migration Check ---');
    console.log('Total Rules:', rules?.length);
    console.log('Workspaces in Rules:', rules?.map(r => r.workspace?.toString()));
    
    const autoreplies = await conn.connection.db?.collection('autoreplies').find({}).toArray();
    console.log('Total AutoReplies:', autoreplies?.length);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkData();
