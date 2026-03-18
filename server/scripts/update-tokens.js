const mongoose = require('mongoose');
const { Workspace } = require('../src/models');
const { decryptToken, encryptToken } = require('../src/services/bsp/gupshupProvisioningService');
require('dotenv').config({path:'../.env'});
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/whatsapp-saas');
  // Only doing this for testing since we only have one or two
  const workspaces = await Workspace.find();
  for (const w of workspaces) {
      if(w.gupshupIdentity && w.gupshupIdentity.partnerAppId) {
          console.log('Fixing App Id:', w.gupshupIdentity.partnerAppId);
          // Hardcoding the partner test token to prove webhooks can be set first. We can fix token management properly later if needed.
          w.gupshupIdentity.appApiKey = encryptToken('e8fcq8y0x9s9qax1i3srfpyuqumslmtg');
          await w.save();
      }
  }
  process.exit(0);
}
run();
