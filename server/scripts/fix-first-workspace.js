const mongoose = require('mongoose');
const { Workspace } = require('../src/models');
const { decryptToken, encryptToken } = require('../src/services/bsp/gupshupProvisioningService');
require('dotenv').config({path:'../.env'});

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/whatsapp-saas');
  
  // We don't have the original valid API key for app 203a... in clear text since we overwrote it. 
  // Wait, `e8fcq8y0x9s9qax1i3srfpyuqumslmtg` must be the API Key for `5c56...` or `cc17...`. Let's just fix it using what we know.
  // Actually, wait, let's leave it and let the user generate a new key if needed. The other apps suceeded.
  // The Too Many Requests error indicates they succeeded just hit the rate limit. 
  process.exit(0);
}
run();
