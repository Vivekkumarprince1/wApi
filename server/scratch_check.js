const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function check() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const db = mongoose.connection.db;
    
    // Find the workspace ID for "fmpg"
    const workspace = await db.collection('workspaces').findOne({ name: /fmpg/i });
    if (!workspace) {
      console.log('Workspace "fmpg" not found.');
      process.exit(1);
    }
    console.log('Workspace Found:', workspace._id.toString());

    // Count conversations
    const total = await db.collection('conversations').countDocuments({});
    console.log('Total conversations in DB:', total);

    const forWs = await db.collection('conversations').countDocuments({ workspace: workspace._id });
    console.log('Conversations for this workspace (ObjectId):', forWs);

    const forWsString = await db.collection('conversations').countDocuments({ workspace: workspace._id.toString() });
    console.log('Conversations for this workspace (String):', forWsString);

    if (forWs > 0 || forWsString > 0) {
      const sample = await db.collection('conversations').findOne({ 
        $or: [{ workspace: workspace._id }, { workspace: workspace._id.toString() }] 
      });
      console.log('Sample conversation:', JSON.stringify(sample, null, 2));
    } else {
      const anyOne = await db.collection('conversations').findOne({});
      if (anyOne) {
        console.log('Sample conversation from ANOTHER workspace:', {
          id: anyOne._id,
          workspace: anyOne.workspace,
          workspaceType: typeof anyOne.workspace
        });
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
