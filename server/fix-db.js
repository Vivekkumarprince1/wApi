const mongoose = require('mongoose');
require('dotenv').config({path: '/Users/vivek/devlopment projects/wApi/wApi-new/server/.env'});
const { Workspace } = require('./src/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const workspace = await Workspace.findOne({ 'gupshupIdentity.partnerAppId': '203a5e43-c560-44c8-be2e-4044e0b0b941' });
    workspace.phoneNumberId = '1048459375014890';
    workspace.bspPhoneNumberId = '1048459375014890';
    workspace.whatsappPhoneNumberId = '1048459375014890';
    await workspace.save();
    console.log("Fixed phoneNumberId to 1048459375014890");
  } finally {
    process.exit();
  }
});
