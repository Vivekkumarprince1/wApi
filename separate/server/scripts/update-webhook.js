require('dotenv').config();
const mongoose = require('mongoose');
const { Workspace } = require('../src/models');
const axios = require('axios');
const bspConfig = require('../src/config/bspConfig');
const { decryptToken, resolveWhatsAppWebhookUrl } = require('../src/services/bsp/gupshupProvisioningService');

async function updateAllWebhooks() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whatsapp-saas');
  console.log('Connected to Database');

  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || resolveWhatsAppWebhookUrl();
  console.log(`Target Webhook URL: ${webhookUrl}`);

  if (!webhookUrl) throw new Error('No WHATSAPP_WEBHOOK_URL found');

  const workspaces = await Workspace.find({ 
    $or: [
      { "gupshupIdentity.partnerAppId": { $exists: true, $ne: null } },
      { "gupshupAppId": { $exists: true, $ne: null } }
    ]
  });

  console.log(`Found ${workspaces.length} workspaces`);

  for (const w of workspaces) {
    const appId = w.gupshupIdentity?.partnerAppId || w.gupshupAppId;
    let token = null;

    const rawToken = w.gupshupIdentity?.appApiKey || w.gupshupIdentity?.token;
    if (rawToken) {
      if (typeof decryptToken === 'function') {
        try { token = decryptToken(rawToken); } catch(e) { token = rawToken; }
      } else { token = rawToken; }
    } else {
      token = process.env.GUPSHUP_PARTNER_TOKEN;
    }

    if (!appId || !token) {
      console.log(`Skipping workspace ${w._id}: Missing appId or token`);
      continue;
    }

    try {
      console.log(`Updating webhooks for App: ${appId}...`);
      
      // Get existing subscriptions
      const getRes = await axios.get(`${bspConfig.partnerBaseUrl}/partner/app/${appId}/subscription`, {
        headers: { 'Authorization': token, 'token': token }
      }).catch(e => { console.error("GET sub error:", e.response?.data); throw e; });
      
      const subs = getRes.data?.subscriptions || [];
      console.log(`Found ${subs.length} existing subscriptions.`);

      for (const sub of subs) {
        if (!sub.id) continue;
        console.log(`Deleting subscription ${sub.id}: ${sub.mode}...`);
        await axios.delete(`${bspConfig.partnerBaseUrl}/partner/app/${appId}/subscription/${sub.id}`, {
          headers: { 'Authorization': token, 'token': token }
        }).catch(e => console.log("DELETE ignored:", e.message));
      }

      // Recreate them
      const requiredModes = [
        { mode: 'MESSAGE', tag: 'message_events' },
        { mode: 'FAILED', tag: 'failed_events' },
        { mode: 'BILLING', tag: 'billing_events' }
      ];

      for (const reqSub of requiredModes) {
        const form = new URLSearchParams();
        form.set('url', webhookUrl);
        form.set('tag', reqSub.tag);
        form.set('version', '3');
        form.set('modes', reqSub.mode);

        console.log(`Creating ${reqSub.mode} subscription...`);
        await axios.post(`${bspConfig.partnerBaseUrl}/partner/app/${appId}/subscription`, form, {
          headers: {
            'Authorization': token,
            'token': token,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }).catch(e => {
            console.log(`Error creating ${reqSub.mode}:`, e.response?.data?.message || e.message)
        });
      }
      console.log(`✅ Success for ${appId}`);
    } catch (err) {
      console.error(`❌ Failed for ${appId}:`, err.message);
    }
  }

  console.log('Done.');
  process.exit(0);
}

updateAllWebhooks().catch(err => {
  console.error(err);
  process.exit(1);
});
