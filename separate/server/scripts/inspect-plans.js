const mongoose = require('mongoose');
const { Workspace, Plan } = require('./src/models');
require('dotenv').config();

async function debug() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const workspaces = await Workspace.find().populate('plan');
    for (const ws of workspaces) {
      console.log(`Workspace: ${ws.name} (${ws._id})`);
      console.log(`Plan: ${ws.plan?.name || 'NONE'} (${ws.plan?.slug || 'NONE'})`);
      console.log(`Features: ${JSON.stringify(ws.plan?.features || [])}`);
      console.log('---');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
