const mongoose = require('mongoose');
require('dotenv').config({path: '/Users/vivek/devlopment projects/wApi/wApi-new/server/.env'});
const { Workspace } = require('./src/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const workspace = await Workspace.findOne({ 'gupshupIdentity.partnerAppId': '203a5e43-c560-44c8-be2e-4044e0b0b941' });
    console.log("Current phoneNumberId:", workspace.phoneNumberId);
    console.log("Current bspPhoneNumberId:", workspace.bspPhoneNumberId);
    console.log("Current whatsappPhoneNumberId:", workspace.whatsappPhoneNumberId);
  } finally {
    process.exit();
  }
});
