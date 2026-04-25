require("dotenv").config({ path: "../.env" });
const { getPartnerHeaders } = require("../src/services/bsp/gupshupService");
const { encryptToken } = require("../src/services/bsp/gupshupProvisioningService");
const mongoose = require("mongoose");
const axios = require("axios");

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    const { Workspace } = require("../src/models/index");
    const workspaces = await Workspace.find({ "gupshupIdentity.partnerAppId": { $exists: true, $ne: null } });
    
    console.log(`Found ${workspaces.length} workspaces with apps.`);
    const headers = await getPartnerHeaders();
    
    for (const w of workspaces) {
        try {
            const appId = w.gupshupIdentity.partnerAppId;
            console.log(`Fetching token for App ID: ${appId} (Workspace: ${w.name})`);
            const tokenRes = await axios.get(`https://partner.gupshup.io/partner/app/${appId}/token`, { headers });
            const token = tokenRes.data?.token?.token || tokenRes.data?.token;
            if(token && typeof token === "string") {
                w.gupshupIdentity.appApiKey = encryptToken(token);
                await w.save();
                console.log(`✅ Restored correct token for workspace: ${w.name}`);
            } else {
                console.log(`⚠️ No string token in response for ${appId}`, tokenRes.data);
            }
        } catch(e) {
            console.error(`❌ Failed to restore token for ${w.name}`, e.response?.data || e.message);
        }
    }
    
    process.exit(0);
}
fix();