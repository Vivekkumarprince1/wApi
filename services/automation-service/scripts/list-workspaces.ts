import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const SOURCE_URI = 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';

async function listWorkspaces() {
  try {
    const conn = await mongoose.connect(SOURCE_URI);
    const workspaces = await conn.connection.db?.collection('workspaces').find({}).toArray();
    console.log('--- Workspaces in Source ---');
    console.log(workspaces?.map(w => ({ 
      id: w._id.toString(), 
      name: w.name, 
      uuid: w.uuid,
      idType: typeof w._id
    })));
    
    // Also check if any automation rules have DIFFERENT workspace ID formats (string vs objectid)
    const rules = await conn.connection.db?.collection('automationrules').find({}).limit(5).toArray();
    console.log('--- Sample Rules Workspace IDs ---');
    console.log(rules?.map(r => ({ workspace: r.workspace, type: typeof r.workspace })));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

listWorkspaces();
