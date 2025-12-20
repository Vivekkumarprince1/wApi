require('dotenv').config();
const mongoose = require('mongoose');

async function checkDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');
  
  // Check workspaces
  const workspaces = await mongoose.connection.db.collection('workspaces').find({}).toArray();
  console.log('=== WORKSPACES ===');
  workspaces.forEach((w, i) => {
    console.log(`${i+1}. ${w.name} (${w._id})`);
    console.log(`   WABA ID: ${w.wabaId}`);
    console.log(`   Phone ID: ${w.whatsappPhoneNumberId}`);
    console.log(`   Has Token: ${!!w.whatsappAccessToken}`);
    console.log('');
  });
  
  // Check users
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log('=== USERS ===');
  users.forEach((u, i) => {
    console.log(`${i+1}. ${u.email} -> workspace: ${u.workspace}`);
  });
  
  // Check templates per workspace
  console.log('\n=== TEMPLATES BY WORKSPACE ===');
  for (const w of workspaces) {
    const templates = await mongoose.connection.db.collection('templates').find({ workspace: w._id }).toArray();
    console.log(`\nWorkspace: ${w.name} (${w._id})`);
    console.log(`Templates: ${templates.length}`);
    templates.forEach(t => {
      console.log(`  - ${t.name} | ${t.status} | Source: ${t.source || 'local'}`);
    });
  }
  
  await mongoose.connection.close();
}

checkDB().catch(console.error);
