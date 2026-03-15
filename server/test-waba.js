const mongoose = require('mongoose');
require('dotenv').config({path: '/Users/vivek/devlopment projects/wApi/wApi-new/server/.env'});
const { Workspace } = require('./src/models');
const { getWabaInfo, resolveAppToken } = require('./src/services/bsp/gupshupService');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const workspace = await Workspace.findOne({ 'gupshupIdentity.partnerAppId': '203a5e43-c560-44c8-be2e-4044e0b0b941' });
  if (!workspace) {
    console.log("Workspace not found");
    process.exit();
  }
  const appApiKey = resolveAppToken(workspace);
  try {
    const wabaInfo = await getWabaInfo('203a5e43-c560-44c8-be2e-4044e0b0b941', appApiKey);
    console.log("WABA INFO RESPONSE:", JSON.stringify(wabaInfo, null, 2));
    
    // Also query WABA phone numbers
    const { getWABAPhoneNumbers } = require('./src/services/bsp/gupshupService');
    const phoneNumbers = await getWABAPhoneNumbers(null, wabaInfo.id || '2204695223399659');
    console.log("PHONE NUMBERS RESPONSE:", JSON.stringify(phoneNumbers, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}).catch(console.error);
